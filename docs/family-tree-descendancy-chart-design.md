# Family Tree — Descendancy Chart Design

---

## 1. Core Concepts

### Universe
For a given root person P, the universe is **D(P)** — the complete set of all
descendants of P across all generations.

### Generations
D(P) is partitioned into disjoint generation subsets:

- G₀ = { P }
- G₁ = { c | c is a child of P }
- G₂ = { c | c is a child of some member of G₁ }
- Gₙ = { c | c is a child of some member of Gₙ₋₁ }
- D(P) = G₀ ∪ G₁ ∪ ... ∪ Gₙ,  where Gᵢ ∩ Gⱼ = ∅ for i ≠ j

The chart displays a fixed window of **g generations** at a time.

---

## 2. Filters

A filter restricts the visible subset of D(P) without mutating it.

### Spouse Filter — Spouse(X, S)
- Operates locally on D(X), the subtree rooted at X
- Restricts X's children to only those belonging to the union of X and S
- All deeper generations are indirectly filtered (they must descend from a
  visible child)
- Has no effect on any ancestor of X or any sibling subtree of X
- Multiple spouse filters may be active simultaneously since each operates
  on a non-overlapping subtree

### Filter Composition
Given active filters Spouse(X₁, S₁), Spouse(X₂, S₂), ... where no Xᵢ is an
ancestor of another Xⱼ, the visible set is D(P) with each filter applied
independently to its respective subtree.

Removing a filter causes that subtree to expand back to its full unfiltered
state. It does not affect any other active filter.

---

## 3. Actions

| Action | Description |
|---|---|
| **Root(P)** | Sets P as root. D(P) becomes the universe. All active filters are cleared. |
| **ShowSpouses(P)** | Opens the spouse drawer for P, listing all of P's spouses. |
| **Spouse(P, S)** | Applies a spouse filter to the subtree rooted at P, restricting children to the union of P and S. |
| **RemoveSpouse(P)** | Removes the active spouse filter at P. D(P) reverts to showing all descendants. |
| **ShowSiblings(P)** | Opens a sibling picker for P, listing all of P's siblings. |
| **SelectSibling(P, S)** | Equivalent to Root(sharedParent(P, S)). Roots the tree at the shared parent of P and sibling S. |
| **Parents(P)** | Composite action: Root(father(P)) + Spouse(father(P), mother(P)). Roots at P's father and activates the union with P's mother, showing P and all full siblings. |

---

## 4. Node Types

All nodes share a common base type. The layout algorithm operates on nodes
uniformly — it only needs to know a node's computed width and its children.

### 4.1 Base Node

```
Node<T>:
  content     : T                  -- the data this node displays
  children    : Node[]             -- child nodes in the tree
  x           : number             -- assigned during Pass 2 (layout)
  y           : number             -- assigned during Pass 2 (layout)

  computedWidth(gap: number) : number   -- computed during Pass 1
  render()                   : SVG      -- draws the node at (x, y)
```

### 4.2 PersonNode

Represents a single individual.

```
PersonNode extends Node<Person>:

  content:
    id          : string
    firstName   : string
    lastName    : string
    birthYear?  : number
    deathYear?  : number
    photoUrl?   : string

  computedWidth(gap):
    if children is empty:
      return PERSON_WIDTH
    else:
      childrenTotal = sum of child.computedWidth(gap) for each child
      totalGaps     = (children.length - 1) * gap
      return max(PERSON_WIDTH, childrenTotal + totalGaps)

  render():
    draw a card at (x, y) showing name and lifespan
```

### 4.3 UnionNode

Represents the union of two people. Its children are the children of that union.
The connector line to children always originates from the center of the UnionNode,
which is the midpoint between the two PersonNodes.

```
UnionNode extends Node<[PersonNode, PersonNode]>:

  content:
    [PersonNode, PersonNode]   -- the two people in this union

  computedWidth(gap):
    unionWidth    = PERSON_WIDTH + CONNECTOR_WIDTH + PERSON_WIDTH
    if children is empty:
      return unionWidth
    else:
      childrenTotal = sum of child.computedWidth(gap) for each child
      totalGaps     = (children.length - 1) * gap
      return max(unionWidth, childrenTotal + totalGaps)

  render():
    left.x  = this.x - CONNECTOR_WIDTH/2 - PERSON_WIDTH/2
    left.y  = this.y
    right.x = this.x + CONNECTOR_WIDTH/2 + PERSON_WIDTH/2
    right.y = this.y

    draw left.render()
    draw horizontal line from (left.x + PERSON_WIDTH/2, y)
                           to (right.x - PERSON_WIDTH/2, y)
    draw diamond ◆ at (this.x, this.y)
    draw right.render()
```

---

## 5. Layout Algorithm

The algorithm assigns (x, y) coordinates to every node in the tree. It runs
in two independent passes.

### Constants

```
PERSON_WIDTH    -- fixed width of a PersonNode
PERSON_HEIGHT   -- fixed height of a PersonNode
GAP             -- minimum horizontal space between sibling subtrees
VERTICAL_GAP    -- vertical space between generations
```

### Pass 1 — Compute Widths (Post-order, bottom-up)

Traverse the tree depth-first, visiting the leftmost child first. A node's
width is computed only after all its descendants' widths are known.

```
function computeWidths(node):
  for each child in node.children:
    computeWidths(child)            -- recurse first (post-order)
  node.computedWidth = node.computedWidth(GAP)   -- then compute self
```

Traversal order example:
```
P → c1 → c1.c1 → (leaf, return)
              c1.c2 → (leaf, return)
         (c1 computed)
    c2 → (leaf, return)
    (c2 computed)
(P computed)
```

### Pass 2 — Assign Positions (Pre-order, top-down)

Traverse the tree depth-first again. A node's position is assigned before
its children, because children are positioned relative to their parent.

```
function assignPositions(node, x, depth):
  node.x = x
  node.y = depth * (PERSON_HEIGHT + VERTICAL_GAP)

  -- Lay out children left to right, centered under this node
  leftEdge = x - node.computedWidth(GAP) / 2

  for each child in node.children:
    childCenterX = leftEdge + child.computedWidth(GAP) / 2
    assignPositions(child, childCenterX, depth + 1)
    leftEdge += child.computedWidth(GAP) + GAP
```

### Entry Point

```
function layout(root):
  computeWidths(root)           -- Pass 1
  assignPositions(root, 0, 0)   -- Pass 2, root centered at x=0
```

After layout, every node has an (x, y) position. The SVG canvas is scrollable
and the viewBox is computed from the bounding box of all node positions.

### Key Properties

- **Y position** is determined entirely by generation depth — all nodes in
  the same generation sit on the same horizontal level
- **X position** is determined by subtree width — a node is always centered
  over its children
- **No overlaps** — subtreeWidth ensures siblings never collide
- **Faithful to data shape** — a large subtree takes proportionally more
  horizontal space, communicating the relative size of each branch visually
- **Node type agnostic** — the algorithm treats PersonNode and UnionNode
  identically, only ever calling computedWidth() and reading children

---

## 6. Rendering

- **Technology:** React SVG in a Next.js project
- **Canvas:** Fixed viewport, scrollable, no zoom required
- **Generation limit:** A fixed maximum of g generations is displayed at once
- **Connector lines:** Always drawn from the center-bottom of the parent node
  to the center-top of each child node, regardless of node type
- **Node rendering:** Each node implements its own render() method, returning
  SVG JSX at its assigned (x, y) position
