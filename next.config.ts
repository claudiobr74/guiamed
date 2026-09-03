import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["firebase-admin", "@google-cloud/firestore", "@google-cloud/storage", "exceljs"],
  outputFileTracingIncludes: {
    "/*": ["./node_modules/pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf"],
  },
};

export default nextConfig;
