import { Webhook } from "svix";
import { headers } from "next/headers";
import type { WebhookEvent } from "@clerk/nextjs/server";
import { env } from "~/env";
import { db } from "~/server/db";

export async function POST(req: Request) {
    // 1. Verify the request came from Clerk
    const headerPayload = await headers();
    const svixId = headerPayload.get("svix-id");
    const svixTimestamp = headerPayload.get("svix-timestamp");
    const svixSignature = headerPayload.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
        return new Response("Missing Svix headers", { status: 400 });
    }

    const payload = (await req.json()) as unknown;
    const body = JSON.stringify(payload);

    const wh = new Webhook(env.CLERK_WEBHOOK_SECRET);

    let evt: WebhookEvent;
    try {
        evt = wh.verify(body, {
            "svix-id": svixId,
            "svix-timestamp": svixTimestamp,
            "svix-signature": svixSignature,
        }) as WebhookEvent;
    } catch (err) {
        console.error("Webhook verification failed:", err);
        return new Response("Invalid signature", { status: 401 });
    }

    // 2. Handle the event
    try {
        switch (evt.type) {
            case "user.created":
            case "user.updated": {
                const { id, email_addresses, first_name, last_name, image_url } = evt.data;
                const primaryEmail = email_addresses[0]?.email_address;

                if (!primaryEmail) {
                    console.error(`No email for user ${id}`);
                    return new Response("No email on user", { status: 400 });
                }

                const name = [first_name, last_name].filter(Boolean).join(" ") || null;

                await db.user.upsert({
                    where: { id },
                    create: {
                        id,
                        email: primaryEmail,
                        name,
                        imageUrl: image_url,
                    },
                    update: {
                        email: primaryEmail,
                        name,
                        imageUrl: image_url,
                    },
                });
                break;
            }

            case "user.deleted": {
                const { id } = evt.data;
                if (!id) {
                    return new Response("No user id on deletion event", { status: 400 });
                }
                // deleteMany so missing rows don't throw
                await db.user.deleteMany({ where: { id } });
                break;
            }

            default:
                // Other event types we're not subscribed to; ignore safely
                break;
        }

        return new Response("OK", { status: 200 });
    } catch (err) {
        console.error("Webhook handler error:", err);
        return new Response("Handler error", { status: 500 });
    }
}