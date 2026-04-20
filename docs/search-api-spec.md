# Search API Spec V1

## Endpoint

`GET /api/hotels/search`

## Catalog Endpoint

Frontend search va partner form co the lay toan bo option catalog tu:

`GET /api/catalog/options`

Response:

```json
{
  "success": true,
  "data": {
    "hotelTypes": ["HOTEL", "APARTMENT", "RESORT"],
    "roomCategories": ["STANDARD", "DELUXE", "SUITE"],
    "bedTypes": ["SINGLE", "DOUBLE", "TWIN"],
    "hotelAmenities": ["WIFI", "POOL", "PARKING"],
    "roomAmenities": ["AIR_CONDITIONER", "BALCONY", "BATHTUB"]
  },
  "error": null
}
```

## Muc tieu

- Tra danh sach `hotel summary` cho search list.
- Chi tra hotel book duoc that cho stay da chon.
- Ho tro pagination va sorting de dung duoc theo flow product.

## Query Params

- `province`: required
- `district`: optional
- `checkIn`: required, `yyyy-MM-dd`
- `checkOut`: required, `yyyy-MM-dd`
- `adults`: optional, default `1`
- `rooms`: optional, default `1`
- `page`: optional, default `1`
- `size`: optional, default `10`
- `sort`: optional, default `price_asc`
- `hotelTypes`: optional, comma-separated enum list
- `roomCategories`: optional, comma-separated enum list
- `bedTypes`: optional, comma-separated enum list
- `hotelAmenities`: optional, comma-separated enum list
- `roomAmenities`: optional, comma-separated enum list

## Validation

- `province` khong duoc trong
- `checkIn/checkOut` bat buoc co
- `checkOut > checkIn`
- `adults >= 1`
- `rooms >= 1`
- `page >= 1`
- `size` trong khoang `1..50`
- `sort` chi nhan:
  - `price_asc`
  - `price_desc`
  - `rating_desc`
- `hotelTypes` chi nhan:
  - `HOTEL`
  - `APARTMENT`
  - `RESORT`
  - `VILLA`
  - `HOMESTAY`
  - `HOSTEL`
  - `GUEST_HOUSE`
- `roomCategories` chi nhan:
  - `STANDARD`
  - `DELUXE`
  - `SUITE`
  - `STUDIO`
  - `FAMILY`
- `bedTypes` chi nhan:
  - `SINGLE`
  - `DOUBLE`
  - `TWIN`
- `hotelAmenities` chi nhan:
  - `WIFI`
  - `POOL`
  - `PARKING`
  - `GYM`
  - `SPA`
  - `RESTAURANT`
- `roomAmenities` chi nhan:
  - `AIR_CONDITIONER`
  - `TV`
  - `MINI_BAR`
  - `PRIVATE_BATHROOM`
  - `BATHTUB`
  - `BALCONY`
  - `WINDOW`
  - `DESK`
  - `WARDROBE`
  - `KETTLE`
  - `REFRIGERATOR`
  - `SAFE_BOX`
  - `FREE_WATER`

## Business Rules

- `district` bo trong => search toan `province`
- Hotel chi xuat hien neu:
  - dung location
  - neu co `hotelTypes`, `hotel.hotelType` phai nam trong filter group do
  - hotel co day du tat ca `hotelAmenities` user chon
  - du inventory cho toan bo ky o
  - du `rooms`
  - du `adults`
- `roomCategories`, `bedTypes` va `roomAmenities` duoc ap vao room pool truoc availability/pricing
- Hotel chi pass neu sau khi loc room pool, van con room type du cover stay
- `minPrice` la tong gia cua toan bo stay
- `minPrice` phai tinh tu room type da pass room filters, khong lay tu room type bi loai bo
- Pricing:
  - uu tien `DailyRate`
  - thieu `DailyRate` o ngay nao thi fallback `Room.price`
  - room type bi `isClosed` hoac fail `minStay` khong duoc dung de tinh gia

## Amenity Catalog

### Hotel

- `WIFI`
- `POOL`
- `PARKING`
- `GYM`
- `SPA`
- `RESTAURANT`
- `PET_ALLOWED`

### Room

- `AIR_CONDITIONER`
- `TV`
- `MINI_BAR`
- `PRIVATE_BATHROOM`
- `BATHTUB`
- `BALCONY`
- `WINDOW`
- `DESK`
- `WARDROBE`
- `KETTLE`
- `REFRIGERATOR`
- `SAFE_BOX`
- `FREE_WATER`

## Type Catalog

### Hotel

- `HOTEL`
- `APARTMENT`
- `RESORT`
- `VILLA`
- `HOMESTAY`
- `HOSTEL`
- `GUEST_HOUSE`

### Room Category

- `STANDARD`
- `DELUXE`
- `SUITE`
- `STUDIO`
- `FAMILY`

### Bed Type

- `SINGLE`
- `DOUBLE`
- `TWIN`

## Sort Rules

- `price_asc`: `minPrice` tang dan
- `price_desc`: `minPrice` giam dan
- `rating_desc`: `ratingAvg` giam dan
- Tie-breaker:
  - `hotelId asc`

## Response

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "hotelId": 1,
        "name": "Detail Hotel",
        "address": "Detail Hotel address",
        "province": "Bangkok",
        "district": "District 1",
        "ratingAvg": 4.75,
        "ratingCount": 18,
        "minPrice": 1700000
      }
    ],
    "page": 1,
    "size": 10,
    "totalItems": 37,
    "totalPages": 4,
    "hasNext": true,
    "sort": "price_asc"
  },
  "error": null
}
```

## Rule cho empty result

- Khong co ket qua => tra `200`
- `items = []`
- `totalItems = 0`
- `totalPages = 0`
- `hasNext = false`

## Error Contract

Tat ca loi deu dung chung wrapper:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Du lieu khong hop le",
    "details": [
      {
        "field": "page",
        "message": "Page must be >= 1"
      }
    ]
  }
}
```

Rules:

- Validation loi => `400`, `code = VALIDATION_ERROR`
- `details[]` phai co `field` de frontend bind loi vao dung input
- Hotel id khong ton tai o detail endpoint => `404`, `code = NOT_FOUND`
