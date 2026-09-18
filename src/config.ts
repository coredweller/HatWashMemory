import "dotenv/config";
import { z } from "zod";

// Every value has a default — this app stores no secrets, so it runs with no .env at all.
const envSchema = z.object({
  DB_PATH: z.string().min(1).default("./hatwash.db"),
  IMAGES_DIR: z.string().min(1).default("./data/images"),
  PORT: z.coerce.number().int().positive().default(4180),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

export const config = envSchema.parse(process.env);
