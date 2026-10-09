/** Category tree already localised on the server so the client bundle carries one language only. */
export interface NavCategory {
  slug: string;
  name: string;
  image?: string;
  count: number;
  children: { slug: string; name: string; count: number }[];
}
