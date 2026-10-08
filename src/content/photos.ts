/**
 * Club photos (supplied by Tabor from the current site, 2026-10-07).
 * Static imports give next/image real dimensions and blur placeholders,
 * so images never cause layout shift.
 */
import type { StaticImageData } from "next/image";
import clubhouse from "../../public/images/clubhouse.jpg";
import cartPathTrees from "../../public/images/course-cart-path-trees.jpg";
import fairwayOpen from "../../public/images/course-fairway-open.jpg";
import fairwayRolling from "../../public/images/course-fairway-rolling.jpg";
import footbridgeEvening from "../../public/images/course-footbridge-evening.jpg";
import footbridgePath from "../../public/images/course-footbridge-path.jpg";
import footbridgeWide from "../../public/images/course-footbridge-wide.jpg";
import greenFairway from "../../public/images/course-green-fairway.jpg";
import greenFlag from "../../public/images/course-green-flag.jpg";
import greenShade from "../../public/images/course-green-shade.jpg";
import greenTrees from "../../public/images/course-green-trees.jpg";
import treeLinedDrive from "../../public/images/course-tree-lined-drive.jpg";
import logoSmall from "../../public/images/logo-small.png";
import pool1 from "../../public/images/pool-1.jpg";
import pool2 from "../../public/images/pool-2.jpg";
import pool3 from "../../public/images/pool-3.jpg";

export type Photo = { src: StaticImageData; alt: string };

export const logo: Photo = {
  src: logoSmall,
  alt: "Sabetha Golf Club logo",
};

export const heroPhoto: Photo = {
  src: footbridgeWide,
  alt: "A white footbridge crosses a creek between native grass and a line of trees on the course",
};

export const clubhousePhoto: Photo = {
  src: clubhouse,
  alt: "The white clubhouse and its covered deck, seen across the lawn",
};

export const courseGallery: Photo[] = [
  {
    src: greenFlag,
    alt: "A flag on a raised green, with trees and rolling farmland behind",
  },
  {
    src: greenFairway,
    alt: "A green in the foreground with a long fairway rising behind it",
  },
  {
    src: footbridgePath,
    alt: "A cart path winding to a white footbridge through native grass",
  },
  { src: fairwayRolling, alt: "A rolling fairway with trees beyond" },
  {
    src: greenShade,
    alt: "A shaded green with a flag, framed by tall trees",
  },
  { src: fairwayOpen, alt: "A wide, freshly mowed fairway bordered by trees" },
  { src: greenTrees, alt: "A large green in front of a stand of trees" },
  { src: cartPathTrees, alt: "A cart path curving between tall shade trees" },
  {
    src: treeLinedDrive,
    alt: "A gravel drive lined with large shade trees beside the course",
  },
  {
    src: footbridgeEvening,
    alt: "The footbridge and native grass in evening light",
  },
];

export const poolPhotos: Photo[] = [
  {
    src: pool1,
    alt: "Swimmers in the club pool, with shade canopies and the wading pool behind",
  },
  { src: pool2, alt: "The club pool beside the clubhouse on a sunny day" },
  { src: pool3, alt: "The pool deck with shade canopies and trees" },
];
