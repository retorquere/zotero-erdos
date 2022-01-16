/******************************************************************************
 * Created 2008-08-19.
 *
 * Dijkstra path-finding functions. Adapted from the Dijkstar Python project.
 *
 * Copyright (C) 2008
 *   Wyatt Baldwin <self@wyattbaldwin.com>
 *   All rights reserved
 * Copyright (C) 2022
 *   Emiliano Heyns <Emiliano.Heyns@iris-advies.com>
 *   All rights reserved
 *
 * Licensed under the MIT license.
 *
 *   http://www.opensource.org/licenses/mit-license.php
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *****************************************************************************/

// vertex points to neighbour points to cost
type DiGraph = Record<string, Record<string, number>>

export function single_source_shortest_paths(graph: DiGraph, src: string, dst: string) {
  // Predecessor map for each vertex that has been encountered.
  // vertex ID => predecessor vertex ID
  const predecessors: Record<string, string[]> = {};

  // Costs of shortest paths from s to all vertices encountered.
  // vertex ID => cost
  const costs = {};
  costs[src] = 0;

  // Costs of shortest paths from s to all vertices encountered; differs from
  // `costs` in that it provides easy access to the vertex that currently has
  // the known shortest path from s.
  // XXX: Do we actually need both `costs` and `open`?
  const open = new PriorityQueue
  open.push(src, 0);

  while (!open.empty()) {
    // In the vertices remaining in graph that have a known cost from s,
    // find the vertex, u, that currently has the shortest path from s.
    const { vertex: u, cost: cost_of_s_to_u } = open.pop();

    // Get vertices adjacent to u and explore the edges that connect u to those vertices, updating
    // the cost of the shortest paths to any or all of those vertices as
    // necessary. v is the vertice across the current edge from u.
    for (const [v, cost_of_e] of Object.entries(graph[u] || {})) {
      // Cost of s to u plus the cost of u to v across e--this is *a*
      // cost from s to v that may or may not be less than the current
      // known cost to v.
      const cost_of_s_to_u_plus_cost_of_e = cost_of_s_to_u + cost_of_e;

      // If we haven't visited v yet OR if the current known cost from s to
      // v is greater than the new cost we just found (cost of s to u plus
      // cost of u to v across e), update v's cost in the cost list and
      // update v's predecessor in the predecessor list (it's now u).
      const cost_of_s_to_v = costs[v];
      const first_visit = (typeof costs[v] === 'undefined');
      if (first_visit || cost_of_s_to_v > cost_of_s_to_u_plus_cost_of_e) {
        costs[v] = cost_of_s_to_u_plus_cost_of_e;
        open.push(v, cost_of_s_to_u_plus_cost_of_e);
        predecessors[v] = [u];
      }
      else if (cost_of_s_to_v === cost_of_s_to_u_plus_cost_of_e) {
        predecessors[v].push(u)
      }
    }
  }

  if (typeof dst !== 'undefined' && typeof costs[dst] === 'undefined') {
    throw new Error(`Could not find a path from ${src} to ${dst}.`)
  }

  return predecessors
}

export function extract_shortest_path_from_predecessor_list(predecessors, dst) {
  const vertices = [];
  let u = dst;
  let predecessor;
  while (u) {
    u = typeof u === 'string' ? u : u[0]
    vertices.push(u)
    u = predecessors[u];
  }
  vertices.reverse();
  return vertices;
}

export function find_path(graph: DiGraph, src: string, dst: string) {
  const predecessors = single_source_shortest_paths(graph, src, dst);
  return extract_shortest_path_from_predecessor_list(predecessors, dst);
}

/**
 * Priority queue implementation.
 */
class PriorityQueue {
  private queue: MinHeap
  private priorities: Record<string, number>

  constructor() {
    this.queue = new MinHeap(this.default_sorter.bind(this))
    this.priorities = {};
  }

  default_sorter(a, b) {
    return this.priorities[a] - this.priorities[b];
  }

  /**
   * Add a new item to the queue and ensure the highest priority element
   * is at the front of the queue.
   */
  push(vertex, cost) {
    this.priorities[vertex] = cost;
    this.queue.insert(vertex);
  }

  /**
   * Return the highest priority element in the queue.
   */
  pop() {
    const vertex = this.queue.pop();
    const cost = this.priorities[vertex];
    delete this.priorities[vertex];

    return { vertex, cost }
  }

  empty() {
    return this.queue.empty()
  }
}

/**
 * Min heap implementation.
 */
class MinHeap {
  private container: string[]

  constructor(sorter: (a: string, b: string) => number) {
    this.sorter = sorter;
    this.container = [];
  }

  sorter(a: string, b: string): number {
    return 0
  }

  /**
   * Finding parents or children with indexes.
   */
  get_left_child_index(parent_index: number): number {
    return (2 * parent_index) + 1;
  }
  get_right_child_index(parent_index: number): number {
    return (2 * parent_index) + 2;
  }
  get_parent_index(child_index: number): number {
    return Math.floor((child_index - 1) / 2);
  }
  has_parent(child_index: number): boolean {
    return this.get_parent_index(child_index) >= 0;
  }
  has_left_child(parent_index: number): boolean {
    return this.get_left_child_index(parent_index) < this.container.length;
  }
  has_right_child(parent_index: number): boolean {
    return this.get_right_child_index(parent_index) < this.container.length;
  }
  left_child(parent_index: number): string {
    return this.container[this.get_left_child_index(parent_index)];
  }
  right_child(parent_index: number): string {
    return this.container[this.get_right_child_index(parent_index)];
  }
  parent(child_index: number): string {
    return this.container[this.get_parent_index(child_index)];
  }
  swap(first: number, second: number): void {
    [ this.container[first], this.container[second] ] = [ this.container[second], this.container[first] ]
  }

  /**
   * Returns element with the highest priority. 
   */
  pop() {
    if (this.container.length === 1) return this.container.pop();

    const head_index = 0;
    const last_element = this.container.pop();
    const first_element = this.container[head_index];

    this.container[head_index] = last_element;
    this.heapify_down(head_index);

    return first_element;
  }

  insert(vertex: string) {
    this.container.push(vertex);
    this.heapify_up(this.container.length - 1);
  }

  heapify_up(start_index) {
    let current_index = start_index || this.container.length - 1;

    while (this.has_parent(current_index) && !this.pair_is_in_correct_order(this.parent(current_index), this.container[current_index])) {
      this.swap(current_index, this.get_parent_index(current_index));
      current_index = this.get_parent_index(current_index);
    }
  }
  
  heapify_down(start_index = 0) {
    let current_index = start_index;
    let next_index = null;

    while (this.has_left_child(current_index)) {
      if (this.has_parent(current_index) && this.pair_is_in_correct_order(this.right_child(current_index), this.left_child(current_index))) {
        next_index = this.get_right_child_index(current_index);
      } else {
        next_index = this.get_left_child_index(current_index);
      }

      if (this.pair_is_in_correct_order(this.container[current_index], this.container[next_index])) {
        break;
      }

      this.swap(current_index, next_index);
      current_index = next_index;
    }
  }

  empty() {
    return this.container.length === 0;
  }

  pair_is_in_correct_order(a, b) {
    return this.sorter(a, b) < 0;
  }
}

const dst = 'C3'
const src = 'C2'

const edges = require('./edges.json')

const graph: DiGraph = {}
for (let [v, w] of edges) {
  graph[v] = graph[v] || {}
  graph[v][w] = 1

  graph[w] = graph[w] || {}
  graph[w][v] = 1
}

console.log(graph)
console.log(find_path(graph, src, dst))
