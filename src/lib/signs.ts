import QRCode from "qrcode";

export const SHEETS = {
  hole1: "Hole #1: Pay to Play",
  tees: "Tee boxes: Order to the Course",
  carts: "Cart stickers",
} as const;
export type Sheet = keyof typeof SHEETS;

export const HOLES = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/** Where each printed code points. Absolute, since phones scan it cold. */
export function signUrls(base: string) {
  const url = (path: string) => new URL(path, base).toString();
  return {
    pay: url("/pay"),
    order: url("/order"),
    hole: (n: number) => url(`/order?hole=${n}`),
  };
}

/**
 * QR code as inline SVG. Same options everywhere (and in the e2e check), so
 * a printed code can be verified by regenerating it from its URL.
 * Level M survives a bit of rain, sun fade or a scuffed sticker.
 */
export function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
  });
}
