import { Cast, Embeds } from "@shared/types/models";
import { sql } from "kysely";

import { db } from "../database/db";
import { formatHash } from "./casts";
import { processEmbeds } from "./embeds";

export async function getFeed({
  fid,
  limit = 25,
}: {
  fid: string;
  limit?: number;
}) {
  const follows = db
    .selectFrom("links")
    .select("target_fid")
    .where("fid", "=", fid);

  const profiles = db
    .selectFrom("user_data")
    .select([
      "fid",
      sql`MAX(CASE WHEN type = 1 THEN value ELSE NULL END)`.as("pfp_url"),
      sql`MAX(CASE WHEN type = 2 THEN value ELSE NULL END)`.as("display_name"),
      sql`MAX(CASE WHEN type = 3 THEN value ELSE NULL END)`.as("bio"),
      sql`MAX(CASE WHEN type = 6 THEN value ELSE NULL END)`.as("username"),
    ])
    .where("deleted_at", "is", null)
    .where("fid", "in", follows)
    .groupBy("fid")
    .as("profiles");

  const casts = await db
    .selectFrom("casts")
    .leftJoin(profiles, "profiles.fid", "casts.fid")
    .select([
      "casts.hash",
      "casts.timestamp",
      "casts.text",
      "casts.embeds",
      "casts.mentions",
      "casts.mentions_positions",
      "casts.fid",
      "profiles.pfp_url",
      "profiles.display_name",
      "profiles.bio",
      "profiles.username",
    ])
    .where("casts.fid", "in", follows)
    .where("casts.deleted_at", "is", null)
    .where("casts.parent_hash", "is", null)
    .orderBy("casts.timestamp", "desc")
    .limit(limit)
    .execute();

  return casts.map((row) => {
    const { fid, pfp_url, display_name, bio, username, embeds, ...rest } = row;
    const cast: Cast = {
      ...rest,
      hash: formatHash(row.hash),
      embeds: processEmbeds(row.embeds as any) as Embeds,
      user: {
        fid,
        pfp_url: pfp_url as string,
        display_name: display_name as string,
        bio: bio as string,
        username: username as string,
      },
    };

    return cast;
  });
}
