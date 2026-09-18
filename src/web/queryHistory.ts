import { queryReadonly } from "../db/connection.js";

export interface WashLogRow {
  id: number;
  washed_at: number;
  notes: string | null;
  hat_id: number;
  hat_name: string;
  image_file: string | null;
}

const WASH_LOG_QUERY = `
  SELECT
    w.id         AS id,
    w.washed_at  AS washed_at,
    w.notes      AS notes,
    h.id         AS hat_id,
    h.name       AS hat_name,
    h.image_file AS image_file
  FROM washes w
  JOIN hats h ON h.id = w.hat_id
  ORDER BY w.washed_at DESC, w.id DESC
`;

export function queryWashLog(): WashLogRow[] {
  return queryReadonly<WashLogRow>(WASH_LOG_QUERY);
}
