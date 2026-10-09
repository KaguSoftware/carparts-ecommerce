import type { ElementType, ReactNode } from "react";

/**
 * Props every `linkAs` component (plain "a", next/link, the locale-aware Link) must accept.
 *
 * Typing the polymorphic tag as a bare `ElementType` breaks as soon as a library augments JSX.IntrinsicElements
 * (@react-three/fiber adds every three.js element), because `children` and `className` then intersect to `never`.
 * Narrowing `ElementType` by the props we actually pass keeps the union to real link-like tags.
 */
export interface LinkAsProps {
  href: string;
  className?: string;
  children?: ReactNode;
  rel?: string;
  "aria-label"?: string;
}

export type LinkAs = ElementType<LinkAsProps>;
