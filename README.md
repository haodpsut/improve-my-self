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

## Kiểm dữ liệu trước khi đẩy lên

```bash
node tools/check-data.mjs
```

Cổng này bắt: id trùng, thẻ thiếu mặt trước hoặc thiếu nghĩa tiếng Việt, chỉ số đáp án nằm ngoài
khoảng, lựa chọn trắc nghiệm trùng nhau, và cụm khoá luyện nói không nằm trong câu mẫu. Nó cũng
cảnh báo khi thẻ chưa có nhãn hoặc còn dấu gạch dài trong văn xuôi. Sai thì trả mã thoát khác 0.

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
4. Chạy `node tools/check-data.mjs`, rồi commit.

## Phím tắt

Học khái niệm: `space` lật thẻ, `1` học lại, `2` còn ngập ngừng, `3` thuộc.
Trắc nghiệm: `1` đến `4` chọn đáp án, `enter` sang câu kế.
