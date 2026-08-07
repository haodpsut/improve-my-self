# Improve my self

Trang tĩnh tự học thuật ngữ kỹ thuật: học khái niệm Anh Việt, trắc nghiệm có giải thích, và luyện
nói thành tiếng. Không có backend, không gọi API nào, không có bước build. Toàn bộ nội dung nằm
trong `data/`, sửa JSON là trang đổi theo ngay.

Trang này gộp bốn thứ trước đây nằm rời: quiz viễn thông, quiz thuật ngữ tiếng Nga, thẻ khái niệm
kỹ thuật, và luyện nói. Khác biệt lớn nhất là nội dung không còn sinh bằng mô hình lúc chạy, nên
không cần khoá API và mỗi lần mở đều ra đúng bộ nội dung bạn đã duyệt.

## Chạy tại chỗ

Trang dùng ES module nên trình duyệt chặn `file://`. Cần một máy chủ tĩnh bất kỳ:

```bash
npx serve .          # hoặc: python -m http.server 8000
```

Rồi mở `http://localhost:3000`. Đưa lên Vercel thì chọn framework **Other**, không có lệnh build,
thư mục gốc là thư mục này.

## Hai cổng kiểm, chạy trước khi đẩy lên

```bash
npm run qa        # chạy cả hai, hoặc chạy riêng từng cái bên dưới
```

**`node tools/check-data.mjs` bắt lỗi cấu trúc.** Id trùng, thẻ thiếu mặt trước hoặc thiếu nghĩa
tiếng Việt, chỉ số đáp án nằm ngoài khoảng, lựa chọn trắc nghiệm trùng nhau, cụm khoá luyện nói
không nằm trong câu mẫu. Cảnh báo khi thẻ chưa có nhãn hoặc còn dấu gạch dài trong văn xuôi.

**`node tools/qa.mjs` bắt lỗi chất lượng**, tức những đường người học đoán được mà không cần biết
gì. Nó chặn khi:

- Đáp án đúng dồn về một vị trí quá 40 phần trăm, vì khi đó cứ chọn vị trí đó là ăn điểm.
- Đáp án đúng dồn về một hạng độ dài quá 40 phần trăm, vì khi đó đoán theo độ dài là ăn điểm. Cả
  hai lỗi này đều đã từng xảy ra thật trong kho: có lúc 100 phần trăm đáp án nằm ở vị trí A, và có
  lúc 88 phần trăm đáp án là phương án dài nhất.
- Giải thích tham chiếu theo vị trí phương án, kiểu "phương án cuối", vì chỉ cần ai đó hoán vị lựa
  chọn là lời giải thích thành sai.
- Hai thẻ cùng mặt trước, hai câu cùng đề bài, hai lựa chọn cùng nội dung, lựa chọn kết thúc lửng.

Cả hai cổng trả mã thoát khác 0 khi có lỗi. Cả hai đều đã được thử ngược bằng lỗi gieo sẵn: gieo
sáu loại lỗi vào một bản sao thì `qa.mjs` bắt đủ sáu. Một cổng báo sạch mà chưa từng bị thử ngược
thì không chứng minh được điều gì.

## Cấu trúc dữ liệu

```
data/
  manifest.json           danh mục mọi bộ thẻ, ngân hàng câu hỏi và bộ luyện nói
  cards/<deck>.json       thẻ khái niệm, nuôi cả ba chế độ học
  questions/<deck>.json   câu hỏi hiểu bản chất, viết tay, có giải thích
  speaking/<set>.json     tình huống hội thoại để luyện nói
```

### Một thẻ trong `data/cards/*.json`

```json
{
  "id": "w-latency",
  "en": "Latency",
  "vi": "Độ trễ",
  "ipa": "/ˈleɪ.tən.si/",
  "def_en": "The time a packet needs to travel from source to destination.",
  "def_vi": "Thời gian một gói tin đi từ nguồn tới đích.",
  "say": "The end to end latency stays below one millisecond in this scenario.",
  "tags": ["qos"]
}
```

Bắt buộc: `id`, `en` (hoặc `ru` với bộ tiếng Nga), `vi`. Nên có: `def_en`, `def_vi`, `tags`.
Trường `say` là câu ví dụ để đọc thành tiếng, thiếu thì thẻ đó không xuất hiện ở chế độ đọc.
Bộ tiếng Nga dùng `ru` làm mặt trước, thêm `translit` và `def_ru`, còn `en` là nghĩa tiếng Anh.

**Một thẻ nuôi cả ba chế độ.** Thêm một thẻ là tự động có thêm thẻ ghi nhớ, thêm bốn dạng câu
trắc nghiệm sinh ra từ nó, và nếu có `say` thì thêm một bài đọc thành tiếng. Không phải soạn ba lần.

### Một câu hỏi trong `data/questions/*.json`

```json
{
  "id": "qw-1",
  "q": "Câu hỏi bằng tiếng Anh",
  "q_vi": "Bản tiếng Việt, không bắt buộc",
  "choices": ["A", "B", "C", "D"],
  "answer": 0,
  "why": "Giải thích tiếng Anh",
  "why_vi": "Giải thích tiếng Việt",
  "level": 2
}
```

`answer` là chỉ số trong `choices`, đếm từ 0. Đây là chỗ đặt các câu kiểm tra hiểu bản chất, khác
với câu sinh tự động vốn chỉ kiểm từ vựng. Trang trộn hai loại theo tỉ lệ một một.

### Một tình huống trong `data/speaking/*.json`

```json
{
  "id": "sp-c2",
  "situation": "Bối cảnh, viết bằng tiếng Việt",
  "prompt": "Câu người kia nói, máy sẽ đọc lên",
  "prompt_vi": "Bản dịch",
  "target": "Câu mẫu bạn nên nói ra",
  "target_vi": "Bản dịch câu mẫu",
  "keys": ["cụm bắt buộc phải bật ra được"],
  "tip": "Lời nhắc ngắn về kỹ thuật nói",
  "seconds": 15
}
```

Mọi cụm trong `keys` phải nằm nguyên văn trong `target`, nếu không cổng kiểm sẽ báo lỗi vì bài đó
không bao giờ đạt điểm tối đa được.

## Cách chấm phần nói

Hoàn toàn tất định, không nhờ mô hình nào. Trình duyệt nhận dạng giọng nói bằng Web Speech API,
rồi trang tính điểm theo hai phần: 55% là tỉ lệ cụm khoá bật ra được, 45% là tỉ lệ trùng từ nội
dung với câu mẫu. Nói quá ngắn thì điểm bị nhân 0,6.

Trình duyệt không có nhận dạng giọng nói, chẳng hạn Firefox, vẫn dùng được: trang tự đổi sang ô
nhập chữ và chấm y hệt. Phần đọc câu mẫu lên dùng `speechSynthesis`, có sẵn ở gần như mọi trình duyệt.

Điểm này đo mức trùng với câu mẫu, không đo mức đúng ngữ pháp. Nói đúng ý bằng từ khác sẽ bị điểm
thấp, và đó là giới hạn có chủ ý: mục tiêu của phần này là luyện phản xạ bật ra đúng cụm, không
phải chấm bài viết.

## Cỡ một lượt học

Mỗi lượt chỉ lấy ra một phần của bộ chứ không phải cả bộ, vì học một mạch một trăm thẻ thì không
nhớ được gì. Mặc định là 20 thẻ mỗi lượt học khái niệm, 12 câu mỗi bài trắc nghiệm, 12 tình huống
mỗi lượt luyện nói. Lượt sau sẽ ra thẻ khác.

Đổi được ngay trên thanh phía trên khi đang học, chọn 10, 20, 30, 50 hoặc lấy hết. Lựa chọn này lưu
lại cho những lần sau. Trang của mỗi bộ cũng in rõ tổng số thẻ và cỡ lượt đang đặt, để không nhầm
rằng bộ chỉ có bấy nhiêu.

## Lịch ôn

Thẻ chạy theo hộp Leitner, khoảng cách 0, 1, 2, 4, 8, 16, 32 ngày. Bấm **Thuộc** thì lên một hộp,
**Còn ngập ngừng** thì giữ nguyên, **Học lại** thì rơi về hộp 0 và quay lại ngay trong buổi. Trả lời
sai một câu trắc nghiệm sinh từ thẻ cũng kéo thẻ đó về hộp 0.

Tiến độ lưu bằng `localStorage`, không rời khỏi máy. Trang **Tiến độ** có nút xuất ra JSON và nạp lại,
dùng khi đổi máy hoặc trước khi xoá dữ liệu duyệt web.

## Thêm một bộ thẻ mới

1. Tạo `data/cards/<id>.json` theo mẫu ở trên.
2. Thêm một mục vào mảng `decks` của `data/manifest.json`, gồm `id`, `file`, `title`, `icon`,
   `lang` (`en-vi` hoặc `ru-vi`), `blurb`, `color`, `group`.
3. Muốn có câu hỏi hiểu bản chất thì thêm `data/questions/<id>.json` và một mục vào `quizzes`.
4. Chạy `npm run qa`, rồi commit.

## Khi soạn câu trắc nghiệm mới

Ba điều dễ làm hỏng cả ngân hàng câu hỏi mà mắt thường không thấy:

- **Đừng để đáp án đúng luôn ở vị trí đầu.** Rất dễ mắc khi soạn tuần tự, và người học nhận ra sau
  chừng mười câu.
- **Đừng để đáp án đúng luôn là phương án dài nhất.** Đây là lỗi khó thấy hơn: đáp án đúng viết cho
  chính xác nên tự nhiên dài, còn phương án nhiễu viết cụt. Phương án nhiễu phải dài tương đương, và
  dài ra bằng nội dung thật, tức thêm một cơ chế sai hoặc một điều kiện sai, không phải thêm chữ đệm.
- **Đừng viết giải thích tham chiếu theo vị trí.** Viết "phương án nói rằng độ trễ giảm" chứ đừng
  viết "phương án thứ ba".

`npm run qa` bắt cả ba.

## Phím tắt

Học khái niệm: `space` lật thẻ, `1` học lại, `2` còn ngập ngừng, `3` thuộc.
Trắc nghiệm: `1` đến `4` chọn đáp án, `enter` sang câu kế.
