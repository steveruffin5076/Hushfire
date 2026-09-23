import { Point, Segment } from '../lighting/Raycaster';
import { distanceToSegment, lineOfSight } from './Geometry';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../config/constants';

const CELL = 32;
/** Keeps paths off the walls by roughly a zombie's body radius. */
const CLEARANCE = 24;
const DIAGONAL_COST = Math.SQRT2;

/**
 * Coarse walkability grid + A* over the sector's wall segments, so zombies
 * route through corridors instead of grinding into geometry. Rebuilt whenever
 * the wall set changes (sector load, blast door opening).
 */
export class NavGrid {
  private cols: number;
  private rows: number;
  private blocked: Uint8Array;

  constructor(private walls: Segment[]) {
    this.cols = Math.ceil(CANVAS_WIDTH / CELL);
    this.rows = Math.ceil(CANVAS_HEIGHT / CELL);
    this.blocked = new Uint8Array(this.cols * this.rows);
    this.bake();
  }

  private bake() {
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const center = this.cellCenter(col, row);
        let isBlocked = false;
        for (const seg of this.walls) {
          if (distanceToSegment(center, seg) < CLEARANCE) {
            isBlocked = true;
            break;
          }
        }
        this.blocked[row * this.cols + col] = isBlocked ? 1 : 0;
      }
    }
  }

  private cellCenter(col: number, row: number): Point {
    return { x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 };
  }

  private toCell(p: Point): { col: number; row: number } {
    return {
      col: Math.max(0, Math.min(this.cols - 1, Math.floor(p.x / CELL))),
      row: Math.max(0, Math.min(this.rows - 1, Math.floor(p.y / CELL)))
    };
  }

  private isFree(col: number, row: number): boolean {
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return false;
    return this.blocked[row * this.cols + col] === 0;
  }

  /** Nearest free cell to a position, for when an entity is standing inside clearance. */
  private nearestFree(col: number, row: number): { col: number; row: number } | null {
    if (this.isFree(col, row)) return { col, row };
    for (let ring = 1; ring <= 6; ring++) {
      for (let dc = -ring; dc <= ring; dc++) {
        for (let dr = -ring; dr <= ring; dr++) {
          if (Math.abs(dc) !== ring && Math.abs(dr) !== ring) continue;
          if (this.isFree(col + dc, row + dr)) return { col: col + dc, row: row + dr };
        }
      }
    }
    return null;
  }

  /**
   * World-space waypoints from `from` to `to`, already string-pulled so the
   * zombie walks diagonals instead of stair-stepping the grid. Empty if
   * unreachable.
   */
  findPath(from: Point, to: Point): Point[] {
    const startCell = this.nearestFree(this.toCell(from).col, this.toCell(from).row);
    const goalCell = this.nearestFree(this.toCell(to).col, this.toCell(to).row);
    if (!startCell || !goalCell) return [];

    const start = startCell.row * this.cols + startCell.col;
    const goal = goalCell.row * this.cols + goalCell.col;
    if (start === goal) return [to];

    const count = this.cols * this.rows;
    const gScore = new Float32Array(count).fill(Infinity);
    const fScore = new Float32Array(count).fill(Infinity);
    const cameFrom = new Int32Array(count).fill(-1);
    const open: number[] = [start];
    const inOpen = new Uint8Array(count);

    const heuristic = (index: number) => {
      const col = index % this.cols;
      const row = (index - col) / this.cols;
      const dx = Math.abs(col - goalCell.col);
      const dy = Math.abs(row - goalCell.row);
      return Math.max(dx, dy) + (DIAGONAL_COST - 1) * Math.min(dx, dy);
    };

    gScore[start] = 0;
    fScore[start] = heuristic(start);
    inOpen[start] = 1;

    while (open.length > 0) {
      let bestAt = 0;
      for (let i = 1; i < open.length; i++) {
        if (fScore[open[i]] < fScore[open[bestAt]]) bestAt = i;
      }
      const current = open.splice(bestAt, 1)[0];
      inOpen[current] = 0;

      if (current === goal) {
        return this.reconstruct(cameFrom, current, to);
      }

      const col = current % this.cols;
      const row = (current - col) / this.cols;

      for (let dc = -1; dc <= 1; dc++) {
        for (let dr = -1; dr <= 1; dr++) {
          if (dc === 0 && dr === 0) continue;
          const nc = col + dc;
          const nr = row + dr;
          if (!this.isFree(nc, nr)) continue;
          // No cutting blocked corners on diagonals.
          if (dc !== 0 && dr !== 0 && (!this.isFree(col + dc, row) || !this.isFree(col, row + dr))) continue;

          const neighbor = nr * this.cols + nc;
          const step = dc !== 0 && dr !== 0 ? DIAGONAL_COST : 1;
          const tentative = gScore[current] + step;
          if (tentative >= gScore[neighbor]) continue;

          cameFrom[neighbor] = current;
          gScore[neighbor] = tentative;
          fScore[neighbor] = tentative + heuristic(neighbor);
          if (!inOpen[neighbor]) {
            open.push(neighbor);
            inOpen[neighbor] = 1;
          }
        }
      }
    }

    return [];
  }

  private reconstruct(cameFrom: Int32Array, goal: number, exactGoal: Point): Point[] {
    const cells: Point[] = [];
    let current = goal;
    while (current !== -1) {
      const col = current % this.cols;
      const row = (current - col) / this.cols;
      cells.push(this.cellCenter(col, row));
      current = cameFrom[current];
    }
    cells.reverse();
    cells[cells.length - 1] = exactGoal;
    return this.stringPull(cells);
  }

  /** Drops waypoints that can be skipped with clear line of sight. */
  private stringPull(points: Point[]): Point[] {
    if (points.length <= 2) return points;
    const pulled: Point[] = [points[0]];
    let anchor = 0;

    for (let i = 2; i < points.length; i++) {
      if (!lineOfSight(points[anchor], points[i], this.walls)) {
        pulled.push(points[i - 1]);
        anchor = i - 1;
      }
    }

    pulled.push(points[points.length - 1]);
    return pulled;
  }
}
