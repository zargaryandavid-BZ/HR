import type { TShirtSize } from "@prisma/client";

export const T_SHIRT_SIZES: TShirtSize[] = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];

export const T_SHIRT_SIZE_LABELS: Record<TShirtSize, string> = {
  XS: "XS",
  S: "S",
  M: "M",
  L: "L",
  XL: "XL",
  XXL: "2XL",
  XXXL: "3XL",
};
