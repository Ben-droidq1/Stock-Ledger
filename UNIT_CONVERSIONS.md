# Product Unit Conversions

## Data model

`items.quantity` is a decimal amount in the product's shared canonical `items.stock_unit` (for example, sachet or cup). A profile belongs to both a user and a product, so each shop member can use their own local measures without changing another member's ratios.

```text
unit_profiles
  id, user_id, shop_id, item_id, kind, base_unit, primary_unit, created_at, updated_at
  UNIQUE(user_id, item_id)

unit_conversion_edges
  id, profile_id, from_unit, to_unit, factor
  UNIQUE(profile_id, from_unit, to_unit)
```

Each edge means `1 from_unit = factor to_unit`. Profiles and edges cascade when their user, shop, item, or profile is removed. The API checks that a profile is a connected acyclic hierarchy and that its product belongs to the authenticated user's shop.

## Defaults and examples

Bulk suggestions are per product and editable:

| Product | Cups per Paint | Paints per Bag | Kg per Paint |
| --- | ---: | ---: | ---: |
| Rice | 20 | 12.5 | 4.2 |
| Garri | 20 | 12.5 | 2.8 |
| Other bulk product | 20 | 12.5 | Unset |

Kg may instead be entered per Bag, such as 50 kg. Optional edges can add Derica, Mudu/Kongo, Half-Paint, or another local measure.

Example Rice profile:

```json
{
  "kind": "bulk",
  "base_unit": "cup",
  "primary_unit": "paint",
  "edges": [
    { "from": "paint", "to": "cup", "factor": 20 },
    { "from": "bag", "to": "paint", "factor": 12.5 },
    { "from": "paint", "to": "kg", "factor": 4.2 }
  ]
}
```

A packaged example with 12 sachets per roll and 24 rolls per carton is `carton → roll (24)` and `roll → sachet (12)`. Adding 1.5 cartons stores 432 sachets. Adding 0.5 bag of Rice stores 125 cups.

## UI flow

1. On first product creation, choose Single unit, Bulk foodstuff, or Packaged / sachet. A packaged item requires sachets per roll and rolls per carton. A bulk item starts with the Southern Nigerian suggestions; its ratios and optional kg/intermediate edges can be edited.
2. Enter opening stock in any unit in the hierarchy. The modal previews the canonical amount before saving.
3. Later, Inventory → Add to inventory lets an owner choose any defined unit and a decimal amount. Settings → Unit conversions lets every user define or edit their own ratios for each product.
4. Existing products with stock ask for the current amount and unit when they first receive a conversion profile. This avoids silently reinterpreting existing stock. The base unit cannot be changed once set.

## Conversion logic

`src/unitConversions.js` validates hierarchies and performs graph traversal. For each edge it adds a forward factor and reciprocal reverse factor, then breadth-first searches from the source unit to the target. Quantity is multiplied by the accumulated factor. Inventory writes convert the submitted amount to `items.stock_unit`; ratios remain attached to the user's profile and product.

API routes: `GET /api/unit-conversions`, `PUT /api/unit-conversions/:itemId`, and `POST /api/items/:id/stock`. New unit-aware products submit their profile with `POST /api/items`.
