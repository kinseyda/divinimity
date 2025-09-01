import paper from "paper";
import { mapRange } from "./MathUtils";

export type RedrawEvent = paper.Event & {
  count: number; // Frame count
  time: number; // Time since the start of the animation in seconds
  delta: number; // Time since the last frame in seconds
};
