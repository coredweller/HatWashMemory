import { queryReadonly } from "../db/connection.js";

export interface HatWithLastWash {
  id: number;
  name: string;
  image_file: string | null;
  notes: string | null;
  retired_at: number | null;
  created_at: number;
  /** MAX(washes.washed_at); NULL means this hat has never been washed. */
  last_washed: number | null;
  wash_count: number;
}

const HATS_WITH_LAST_WASH_QUERY = `
  SELECT
    h.id                AS id,
    h.name              AS name,
    h.image_file        AS image_file,
    h.notes             AS notes,
    h.retired_at        AS retired_at,
    h.created_at        AS created_at,
    MAX(w.washed_at)    AS last_washed,
    COUNT(w.id)         AS wash_count
  FROM hats h
  LEFT JOIN washes w ON w.hat_id = h.id
  GROUP BY h.id
`;

export function queryHats(): HatWithLastWash[] {
  return queryReadonly<HatWithLastWash>(HATS_WITH_LAST_WASH_QUERY);
}
