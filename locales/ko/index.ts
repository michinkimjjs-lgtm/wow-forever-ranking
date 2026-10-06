import { api } from "./api";
import { characters } from "./characters";
import { common } from "./common";
import { game } from "./game";
import { guilds } from "./guilds";
import { home } from "./home";
import { rankings } from "./rankings";
import { seo } from "./seo";
import { stats } from "./stats";

export const ko = { common, game, rankings, characters, guilds, home, stats, api, seo };
export type Messages = typeof ko;
