# Search Product Plan
## Skill
- Chuẩn best practice 
- chuẩn SOLID 
- Mô tả code để hiểu thêm phần core
## Muc tieu

Phat trien feature search theo 2 huong song song:

- Bam sat de cuong do an hien tai.
- Nang cap dan de dung duoc theo tu duy product thuc te.
Tai lieu nay dung de giu scope ro rang, tranh sua lan man.

## Quy tac lam viec

- Chi mo rong tiep khi da chot contract cua buoc hien tai.
- Moi phase phai co test truoc khi sang phase tiep theo.
- Uu tien dung nghiep vu truoc, toi uu hieu nang sau.
- Neu docs thay doi sau nay, cap nhat file nay truoc roi moi code.

## Quyet dinh da chot

### Search v1 la summary endpoint

`GET /api/hotels/search` chi tra danh sach tong quan cua hotel, khong tra chi tiet room type.

### Search phai loc hotel dat duoc that

Neu user da truyen `checkIn/checkOut`, ket qua chi duoc gom hotel:

- dung location
- con phong cho toan bo ky o
- du `rooms`
- du `adults`

### `district` la optional

- Co `district`: loc theo `province + district`
- Khong co `district`: loc theo `province`

### `minPrice` la gia thap nhat cho toan bo ky o

Khong dung gia cua 1 dem de hien thi trong search list.

### Pricing uu tien `Daily Rates`

Neu mot room type thieu `daily rate` cho mot ngay:

- fallback ve `basePrice`
- khong loai room type ngay lap tuc

Trong code hien tai chua co `Daily Rates`, nen o Phase 1 tam tinh `minPrice`
tu `Room.price x so dem` cho room type con book duoc.
Sang Phase 2 se thay bang pricing dung theo `Daily Rates`.

### Naming tam thoi

Trong code hien tai, entity `Room` duoc hieu theo nghiep vu la `Room Type`.
Tam thoi giu nguyen ten de tranh lan scope refactor.

### Default input

Tam chap nhan `adults = 1` va `rooms = 1` neu client khong truyen, nhung phai document ro trong API contract.

### Hotel detail tach thanh 2 endpoint

De tranh tron du lieu tinh va du lieu dong theo ngay, hotel detail se tach thanh:

- `GET /api/hotels/{id}`: thong tin tinh cua hotel
- `GET /api/hotels/{id}/available-rooms`: room types book duoc theo stay

### Hotel detail chi tra room types available o v1

Neu user da truyen `checkIn/checkOut`, endpoint `available-rooms` chi tra:

- room type con inventory cho toan bo ky o
- room type khong bi `isClosed`
- room type dat `minStay`
- room type co `stayPrice` tinh duoc 

Khong tra room type sold-out o v1.

### Gia o detail la `stayPrice`

Room type response o v1 se tra tong gia cua toan bo ky o.
Chua them `nightlyBreakdown` o giai doan nay.

## Trang thai hien tai

### Da xong

- Search theo `province/district`
- Validation `checkIn/checkOut`
- Chan `checkOut <= checkIn`
- Filter availability theo toan bo ky o
- Kiem tra du `rooms`
- Kiem tra du `adults`
- Search response tra du summary data:
  - `hotelId`
  - `name`
  - `address`
  - `province`
  - `district`
  - `ratingAvg`
  - `ratingCount`
  - `minPrice`
- Da dung `Daily Rates` de tinh `minPrice` theo ky o
- Da fallback ve `Room.price` khi thieu `DailyRate`
- Integration test cho core search va pricing contract
- Da co `GET /api/hotels/{id}`
- Da co `GET /api/hotels/{id}/available-rooms`
- Da co integration test cho hotel detail va available rooms
- Da tach `HotelStayCriteria` khoi `HotelSearchCriteria`
- Da co pagination cho search
- Da co sorting cho search:
  - `price_asc`
  - `price_desc`
  - `rating_desc`
- Da co spec rieng o `docs/search-api-spec.md`
- Da giam N+1 query lon nhat trong search availability/pricing bang batch load:
  - active rooms
  - daily inventory
  - daily rates
- Da tach file integration test:
  - `HotelSearchIntegrationTest`
  - `HotelDetailIntegrationTest`
- Da chuan hoa error contract theo `ApiResponse.fail(error)` voi:
  - `code`
  - `message`
  - `details[field, message]`
- Da bo sung edge-case test cho:
  - empty result
  - validation field detail
  - `404 NOT_FOUND`
- Da ra soat inventory model cho search v1:
  - `daily_inventory` la source of truth cho stay availability
  - `availableRooms - blockedRooms` la so phong ban duoc moi ngay
  - whole-stay availability lay theo muc thap nhat cua cac ngay trong stay
- Da co amenity filter cho search:
  - `hotelAmenities` loc o muc hotel
  - `roomAmenities` loc room pool truoc availability/pricing
  - `minPrice` tinh tren room da pass `roomAmenities`
- Da co type filter cho search:
  - `hotelTypes` loc o muc hotel
  - `roomCategories` loc room pool truoc availability/pricing
  - `bedTypes` loc room pool truoc availability/pricing
- Partner create/update da chuyen sang type catalogs:
  - `hotelType`
  - `roomCategory`
  - `bedType`
- Da co public catalog API cho frontend/partner form:
  - `GET /api/catalog/options`
  - tra ve hotel types, room categories, bed types va amenity catalogs trong 1 call

### Chua xong

- Chua co sorting/ranking nang cao hon nhu `recommended`

## Search Contract v1

### Request

`GET /api/hotels/search`

Query params:

- `province`: required
- `district`: optional
- `checkIn`: required
- `checkOut`: required
- `adults`: optional, default `1`
- `rooms`: optional, default `1`
- `hotelTypes`: optional, comma-separated
- `roomCategories`: optional, comma-separated
- `bedTypes`: optional, comma-separated
- `hotelAmenities`: optional, comma-separated
- `roomAmenities`: optional, comma-separated

### Response summary

Search list se huong toi cau truc:

- `hotelId`
- `name`
- `address`
- `province`
- `district`
- `ratingAvg`
- `ratingCount`
- `minPrice`

## Hotel Detail Contract v1

### Endpoint 1 - Hotel info

`GET /api/hotels/{id}`

Muc dich:

- tra thong tin tinh cua hotel de render man hinh detail

Response huong toi:

- `hotelId`
- `name`
- `address`
- `province`
- `district`
- `description`
- `ratingAvg`
- `ratingCount`

### Endpoint 2 - Available room types

`GET /api/hotels/{id}/available-rooms`

Query params:

- `checkIn`: required
- `checkOut`: required
- `adults`: optional, default `1`
- `rooms`: optional, default `1`

Response moi room type huong toi:

- `roomId`
- `name`
- `capacity`
- `availableUnits`
- `stayPrice`

## Ke hoach theo phase

### Phase 1 - Align voi de cuong

Muc tieu: search list tra du summary data theo tai lieu.

Tasks:

- [x] Mo rong `HotelSearchItemResponse`
- [x] Cap nhat mapper search
- [x] Bo sung field du lieu can thiet tren `Hotel` neu chua co
- [x] Chot nguon du lieu cho `ratingAvg` va `ratingCount`
- [x] Viet test cho response moi

Definition of done:

- Search response tra du cac field summary
- Test xac nhan JSON response dung shape moi

### Phase 2 - Tinh gia theo stay

Muc tieu: `minPrice` dung theo ky o, khong chi dung availability.

Tasks:

- [x] Ra soat model `Daily Rates`
- [x] Chot rule tinh gia cho stay
- [x] Implement tinh `minPrice` theo tung hotel
- [x] Fallback tu `daily rate` ve `basePrice`
- [x] Viet test cho pricing

Definition of done:

- Search tra `minPrice` hop le cho toan bo ky o
- Test cover ca `daily rate` va fallback `basePrice`

### Phase 3 - Search detail dung nghia product

Muc tieu: tach summary search va hotel detail.

Tasks:

- [x] Thiet ke `GET /api/hotels/{id}`
- [x] Thiet ke `GET /api/hotels/{id}/available-rooms`
- [x] Tra thong tin tinh cua hotel
- [x] Tra room types available theo khoang ngay
- [x] Tra `stayPrice` cho tung room type
- [x] Viet test cho 2 endpoint detail

Definition of done:

- Search list chi giu vai tro summary
- Hotel info va available room types duoc tach ro vai tro
- Frontend hotel detail co du du lieu de render man hinh chi tiet

### Phase 4 - Product usability

Muc tieu: de frontend co the dung that.

Tasks:

- [x] Them `page`
- [x] Them `size`
- [x] Them `sort`
- [x] Ho tro `price_asc`
- [x] Ho tro `price_desc`
- [x] Ho tro `rating_desc`
- [x] Viet test pagination va sorting

Definition of done:

- Search list dung duoc cho UI co phan trang va sap xep

### Phase 5 - Engineering quality

Muc tieu: giam rui ro khi du lieu tang.

Tasks:

- [x] Giam N+1 query trong availability
- [x] Ra soat lai inventory model so voi de cuong
- [x] Chuan hoa error contract
- [x] Bo sung test edge cases con thieu

Definition of done:

- Search on dinh hon khi du lieu lon
- Contract ro rang va test cover tot hon

### Phase 6 - Amenities refinement

Muc tieu: cho user refine ket qua search theo nhu cau product.

Tasks:

- [x] Chot amenity catalog cho hotel va room
- [x] Ho tro `hotelAmenities` tren search endpoint
- [x] Ho tro `roomAmenities` tren search endpoint
- [x] Tinh `minPrice` tren room pool da loc amenity
- [x] Viet integration test cho hotel amenity, room amenity va combined filter

Definition of done:

- Search nhan amenity filters tu query params
- Hotel chi xuat hien khi pass dung semantics hotel + room amenity
- `minPrice` khong bi lech voi room amenity filter

### Phase 7 - Typed hotel/room filters

Muc tieu: chuan hoa cac dimension filter cho hotel va room thay vi dua vao free-text name.

Tasks:

- [x] Them `HotelType`
- [x] Them `RoomCategory`
- [x] Them `BedType`
- [x] Partner create/update gui type catalogs thay vi free-text
- [x] Search filter theo `hotelTypes`
- [x] Search filter theo `roomCategories`
- [x] Search filter theo `bedTypes`
- [x] Viet integration test cho search type filters va partner create contract

Definition of done:

- Partner tao hotel/room bang type catalogs
- User filter duoc hotel va room theo type dimensions
- Search pricing van dung sau khi room pool bi loc theo type
- Frontend co API de render tick options, khong can hardcode catalog

## Thu tu lam tiep theo

Lam dung thu tu nay:

1. Phase 1 - response summary
2. Phase 2 - pricing theo stay
3. Phase 3 - hotel detail
4. Phase 4 - pagination + sorting
5. Phase 5 - performance + hardening

## Task tiep theo ngay luc nay

Task tiep theo duoc chon:

- [ ] Can nhac them `recommended` ranking sau khi co scoring model ro rang
- [x] Thiet ke feature amenities filter cho hotel va room theo nhu cau user
- [x] Chuan hoa hotel/room type de phuc vu filter product
