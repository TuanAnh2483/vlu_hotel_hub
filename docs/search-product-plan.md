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

### Chua xong

- Chua co pagination
- Chua co sorting
- Chua co hotel detail endpoint dung nghia product
- Chua co available room types endpoint dung nghia product
- Chua toi uu N+1 inventory query

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

- [ ] Thiet ke `GET /api/hotels/{id}`
- [ ] Thiet ke `GET /api/hotels/{id}/available-rooms`
- [ ] Tra thong tin tinh cua hotel
- [ ] Tra room types available theo khoang ngay
- [ ] Tra `stayPrice` cho tung room type
- [ ] Viet test cho 2 endpoint detail

Definition of done:

- Search list chi giu vai tro summary
- Hotel info va available room types duoc tach ro vai tro
- Frontend hotel detail co du du lieu de render man hinh chi tiet

### Phase 4 - Product usability

Muc tieu: de frontend co the dung that.

Tasks:

- [ ] Them `page`
- [ ] Them `size`
- [ ] Them `sort`
- [ ] Ho tro `price_asc`
- [ ] Ho tro `price_desc`
- [ ] Ho tro `rating_desc`
- [ ] Viet test pagination va sorting

Definition of done:

- Search list dung duoc cho UI co phan trang va sap xep

### Phase 5 - Engineering quality

Muc tieu: giam rui ro khi du lieu tang.

Tasks:

- [ ] Giam N+1 query trong availability
- [ ] Ra soat lai inventory model so voi de cuong
- [ ] Chuan hoa error contract
- [ ] Bo sung test edge cases con thieu

Definition of done:

- Search on dinh hon khi du lieu lon
- Contract ro rang va test cover tot hon

## Thu tu lam tiep theo

Lam dung thu tu nay:

1. Phase 1 - response summary
2. Phase 2 - pricing theo stay
3. Phase 3 - hotel detail
4. Phase 4 - pagination + sorting
5. Phase 5 - performance + hardening

## Task tiep theo ngay luc nay

Task tiep theo duoc chon:

- [ ] Kiem tra `Hotel` entity hien tai da co `description` chua
- [ ] Thiet ke DTO response cho `GET /api/hotels/{id}`
- [ ] Thiet ke DTO response cho `GET /api/hotels/{id}/available-rooms`
- [ ] Chot service nao se tai su dung pricing + availability logic hien co
