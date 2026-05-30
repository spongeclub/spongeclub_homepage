import galleryData from '../data/gallery.json';

export type GalleryItem = {
  title: string;
  member: string;
  team: string;
  week: number;
  category: string;
  description: string;
  url: string;
  notePath: string;
  thumbnail?: string;
  highlight?: string;
  techStack?: string[];
  features?: string[];
};

export function loadGallery(): { curatedAt: string; items: GalleryItem[] } {
  return galleryData as any;
}
