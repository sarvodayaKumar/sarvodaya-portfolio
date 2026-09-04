import { ImageResponse } from "next/og";

export const size = { width: 48, height: 48 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#16181d",
          color: "#f4f4f5",
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: "-1px",
        }}
      >
        SK
      </div>
    ),
    size
  );
}
