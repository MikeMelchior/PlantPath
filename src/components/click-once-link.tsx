"use client";

import Link, { type LinkProps } from "next/link";
import { useRef } from "react";

type ClickOnceLinkProps = LinkProps & {
    children: React.ReactNode;
    className?: string;
};

/**
 * A Link that ignores rapid repeat clicks. Prevents spam-clicking from firing
 * multiple navigations to the same destination, which would otherwise trigger
 * concurrent server-side renders and potentially racing User upserts in
 * protectedProcedure.
 *
 * Resets when the user navigates somewhere else and comes back.
 */
export function ClickOnceLink({
    children,
    onClick,
    ...linkProps
}: ClickOnceLinkProps) {
    const navigatingRef = useRef(false);

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        if (navigatingRef.current) {
            e.preventDefault();
            return;
        }
        navigatingRef.current = true;
        // Reset shortly after — long enough to swallow rapid clicks, short enough
        // not to feel sticky if the user actually wants to click again.
        setTimeout(() => {
            navigatingRef.current = false;
        }, 1000);
        onClick?.(e);
    };

    return (
        <Link {...linkProps} onClick={handleClick}>
            {children}
        </Link>
    );
}