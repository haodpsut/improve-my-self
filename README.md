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

## Cài lên điện thoại

Trang là một ứng dụng web cài được. Trên Android, nút cài nằm ngay đầu **trang chính** dưới dạng
một thanh xanh, và có bản đầy đủ trong trang **Hôm nay**. Trên iPhone thì Safari không có nút, phải
bấm **Chia sẻ** rồi **Thêm vào màn hình chính**; ba thẻ `apple-mobile-web-app-*` trong `index.html`
là thứ khiến nó mở toàn màn hình chứ không mở trong Safari kèm thanh địa chỉ.

Thanh mời cài phải **vẽ lại khi sự kiện tới**, không vẽ một lần rồi thôi: Chrome gửi
`beforeinstallprompt` sau khi trang dựng xong, có khi vài giây. Vẽ một lần thì hầu như lúc nào cũng
vẽ nhầm ra trạng thái "chưa mời cài". Sự kiện này cũng **không nổ trong khung nhúng**, nên muốn
chụp ảnh kiểm tra thì phải ép số đo thiết bị ở trang cấp cao nhất, không nhét trang vào `iframe`.

Cài xong, biểu tượng mở vào `#/start`. Đường dẫn đó tôn trọng lựa chọn *vào thẳng thẻ đầu tiên*:
bật thì mở máy là thấy ngay thẻ, tắt thì dừng ở trang chuỗi để bấm.

`sw.js` là service worker, và nó chia tệp làm ba loại vì ba lý do khác nhau:

| loại | cách lấy | vì sao |
| --- | --- | --- |
| html, css, js | mạng trước, bản lưu là dự phòng | vỏ trang rất nhẹ, đổi lại là không bao giờ chạy nhầm mã nguồn cũ |
| `data/manifest.json` | mạng trước | nó là mốc để biết bộ dữ liệu đã sang ngày mới chưa |
| tệp dữ liệu còn lại | bản lưu trước | tổng hơn 5 MB, tải lại mỗi lần thì tốn dữ liệu di động |

Bản lưu dữ liệu **tự bị dọn** khi `manifest.updated` đổi sang ngày khác. Việc đối chiếu làm ngay
trong lượt trả `manifest.json` chứ không bằng tin nhắn từ trang gửi sang, vì trang gọi manifest
xong mới gọi tệp thẻ đầu tiên, nên làm ở đó thì không có khe nào cho dữ liệu hôm qua lọt ra.

Nút *Tải toàn bộ dữ liệu* trong trang **Hôm nay** kéo cả 54 tệp về máy để học khi bay hoặc mất sóng.

Sửa mã nguồn thì nhớ đổi **cả hai** chỗ: `VERSION` trong `sw.js` và `<meta name="build">` trong
`index.html`. Cổng QA bắt hai giá trị này phải bằng nhau, và chân trang in nó ra để nhìn một cái là
biết máy đang chạy bản nào.

## Tệp cài Android

Ngoài cách bấm nút cài, trang còn phát một tệp `app/improve-my-self.apk`. Đó là một
**Trusted Web Activity**: một vỏ ứng dụng Android mở chính trang web này ở chế độ toàn màn hình.
Vỏ chỉ chứa vài chục kilobyte mã, nên thêm thẻ hay sửa dữ liệu là ứng dụng đổi theo ngay, **không
phải dựng lại tệp cài**. Chỉ khi đổi tên, biểu tượng hay mã gói mới phải dựng lại.

`.well-known/assetlinks.json` là thứ khiến vỏ đó mở **không kèm thanh địa chỉ**. Nó ghép mã gói
`com.haodpsut.improvemyself` với vân tay SHA-256 của khoá ký. Sai một chữ trong vân tay thì ứng
dụng vẫn chạy, chỉ là chạy kèm thanh địa chỉ của trình duyệt, và đó là loại hỏng rất dễ bỏ qua khi
thử trên máy mình.

Dựng lại tệp cài (cần JDK 17 và Android SDK):

```bash
cd twa
./gradlew.bat assembleRelease --no-daemon
"$ANDROID_HOME/build-tools/34.0.0/zipalign" -p -f 4 \
  app/build/outputs/apk/release/app-release-unsigned.apk aligned.apk
"$ANDROID_HOME/build-tools/34.0.0/apksigner" sign \
  --ks improve-my-self.keystore --ks-key-alias improve --out improve-my-self.apk aligned.apk
```

**Khoá ký nằm ngoài kho mã và không được đưa lên git.** Mất khoá thì không cập nhật được bản đã cài
trên máy người dùng nữa, phải gỡ ra cài lại từ đầu bằng khoá mới.

## Chuỗi học hằng ngày

`#/today` chạy liền ba chặng trên cùng một trang, không đổi hash: lật thẻ, rồi trắc nghiệm **ra đề
từ chính những thẻ vừa lật**, rồi nói thành tiếng. Chặng hai ra đề từ thẻ vừa học chứ không bốc lại
từ toàn kho, nên vừa kiểm đúng phần vừa học vừa chỉ phải tải ngân hàng câu hỏi của vài bộ liên quan
thay vì cả 27 bộ.

`#/plan` là nơi sửa: số thẻ, số câu, số lượt nói, bộ luyện nói, và chọn lấy thẻ từ bộ nào. Kế hoạch
nằm trong `localStorage` dưới khoá `ims.v1`, trường `plan`. Chọn hết các bộ được lưu thành danh
sách **rỗng** chứ không phải liệt kê từng bộ, để sau này thêm bộ mới vào manifest là chuỗi tự lấy
luôn, không phải vào sửa lại.

Chặng nào đặt số 0 thì bị bỏ khỏi chuỗi.

## Ba cổng kiểm, chạy trước khi đẩy lên

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

**`node tools/tele-quiz.mjs --audit` bắt lỗi đóng gói tin nhắn Telegram**, xem mục dưới.

Mọi cổng trả mã thoát khác 0 khi có lỗi, và đều đã được thử ngược bằng lỗi gieo sẵn: gieo sáu loại
lỗi vào một bản sao thì `qa.mjs` bắt đủ sáu, gieo năm loại thì `--audit` bắt đủ năm. Một cổng báo
sạch mà chưa từng bị thử ngược thì không chứng minh được điều gì.

## Bắn câu hỏi về Telegram

`tools/tele-quiz.mjs` bốc vài câu từ kho rồi gửi vào Telegram dưới dạng **quiz poll**: bấm một cái
là hiện đúng sai kèm giải thích. Phần chấm nằm ở phía Telegram, nên script chỉ gửi đi và **không
nhận gì cả**: không webhook, không dịch vụ chạy nền, không cổng nào mở ra ngoài. Chạy xong là thoát.

Đổi lại, nó **không nhớ gì**. Đây là kênh gieo hạt xen kẽ trong ngày, còn lịch ôn Leitner vẫn nằm ở
trang web. Thứ duy nhất được ghi lại là danh sách id vừa gửi, để không bốc trùng ngay, trong
`tools/.tele-quiz-state.json` và không lên git.

Giới hạn của Telegram là 300 ký tự cho đề bài, 100 cho mỗi lựa chọn, 200 cho giải thích. **3456 trên
4491 câu lọt thẳng vào khuôn poll**, nút thắt duy nhất là lựa chọn quá dài. Số còn lại được gửi bằng
tin nhắn thường với đáp án giấu trong spoiler, nên không câu nào bị bỏ. Tỉ lệ lọt lệch mạnh theo bộ:
`en-phrases` và `ru-phrases` lọt hết, còn `qkd` chỉ 17 trên 172 vì mỗi phương án là một mệnh đề dài.
Chạy `--list` để xem bảng đầy đủ. Giải thích dài quá 200 ký tự thì poll hiện bản cắt gọn, rồi một
tin nhắn spoiler ngay sau đó chứa bản đầy đủ.

```bash
node tools/tele-quiz.mjs --list                    # bộ nào lọt bao nhiêu câu
node tools/tele-quiz.mjs --slot sang --dry         # in payload, không gửi
node tools/tele-quiz.mjs --probe                   # gửi một poll thử
node tools/tele-quiz.mjs --slot sang               # gửi thật
node tools/tele-quiz.mjs --decks q-pqc,q-qkd --n 3 # bỏ qua config
```

Khung giờ nằm trong `tools/tele-quiz.config.json`, mỗi khung là một danh sách bộ và một số câu.
`"decks": ["*"]` là lấy toàn kho. Hai biến môi trường bắt buộc: `TELEGRAM_TOKEN` lấy từ @BotFather,
và `TELEGRAM_CHAT_ID` là id của bạn. Lấy id bằng cách nhắn cho bot một câu bất kỳ rồi gọi:

```bash
curl -s "https://api.telegram.org/bot$TELEGRAM_TOKEN/getUpdates" | grep -o '"chat":{"id":[-0-9]*'
```

Token đặt trong tệp `~/.tele-quiz.env` với quyền `chmod 600`, **không bao giờ nằm trong kho mã**.
Crontab trên VPS:

```cron
0  8 * * * . $HOME/.tele-quiz.env; cd /srv/improve-my-self && node tools/tele-quiz.mjs --slot sang  >> /var/log/tele-quiz.log 2>&1
0 15 * * * . $HOME/.tele-quiz.env; cd /srv/improve-my-self && node tools/tele-quiz.mjs --slot chieu >> /var/log/tele-quiz.log 2>&1
0 21 * * * . $HOME/.tele-quiz.env; cd /srv/improve-my-self && node tools/tele-quiz.mjs --slot toi   >> /var/log/tele-quiz.log 2>&1
```

Cần Node 18 trở lên vì script dùng `fetch` có sẵn. Không có phụ thuộc nào, không cần `npm install`.
Chạy trong Docker thì mount thư mục kho vào ảnh `node:22-alpine` rồi để cron của máy chủ gọi
`docker run --rm`, không cần container chạy thường trực.

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

## Bộ đọc từ arXiv, cách làm mới hằng tháng

Hai bộ `arxiv-llm` và `arxiv-agent` khác mọi bộ còn lại ở chỗ chúng nói về thứ **đang thay đổi**,
nên chúng được soạn từ bài báo thật chứ không từ trí nhớ. Mỗi thẻ có trường `src` chứa mã arXiv, và
trang học in kèm đường dẫn để bạn bấm vào đọc bài gốc.

Làm mới:

```bash
npm run arxiv     # tải bài mới nhất về tools/arxiv-llm.json và tools/arxiv-agent.json
```

Lệnh này gọi API công khai của arXiv, lấy khoảng năm trăm bài mỗi mảng trong vài tuần gần nhất, gồm
mã bài, ngày nộp, tiêu đề và tóm tắt. Hai file kết quả **không được commit**, chúng chỉ là nguyên
liệu đầu vào và tái tạo được bất cứ lúc nào.

Sau đó soạn thẻ từ chúng theo ba luật đã đặt ra:

- **Gom theo chủ đề, đừng làm mỗi bài một thẻ.** Một thẻ nên là hướng lặp lại ở nhiều bài, và dẫn
  hai tới bốn mã arXiv làm chứng. Mỗi bài một thẻ thì ra danh mục chứ không ra kiến thức.
- **Nói rõ mức bằng chứng.** Tóm tắt là lời tự nhận của tác giả, chưa qua phản biện. Một kỹ thuật
  nhiều nhóm cùng báo cáo khác hẳn một kỹ thuật mới có một nhóm nói.
- **Không chép con số hiệu năng.** Điểm chuẩn đo và tỉ lệ cải thiện là số một nhóm tự báo, cũ rất
  nhanh. Viết cơ chế và hướng thay đổi thay vì viết số.

Cổng QA chặn nếu một thẻ trong bộ `arxiv-` không dẫn nguồn, hoặc dẫn mã sai dạng.

## Ôn tổng hợp

Với hơn mười lăm bộ thẻ, tự chọn từng bộ để ôn là ma sát vô ích, vì thẻ đến hạn nằm rải khắp nơi.
Hai đường tắt trên trang chính:

- `#/learn/all` xếp hàng đợi theo lịch đến hạn trên **toàn kho**, trộn mọi môn. Mỗi thẻ in kèm tên
  bộ ở cả hai mặt nên vẫn biết nó đến từ đâu.
- `#/quiz/all` rút câu từ toàn kho, gồm mọi câu viết tay cộng câu sinh tự động từ mọi thẻ.

Điểm của bài trộn được ghi vào **đúng môn của từng câu**, không dồn vào một khoá chung, nên bảng
thống kê theo môn ở trang Tiến độ vẫn đúng.

## Lịch ôn

Thẻ chạy theo hộp Leitner, khoảng cách 0, 1, 2, 4, 8, 16, 32 ngày. Bấm **Thuộc** thì lên một hộp,
**Còn ngập ngừng** thì giữ nguyên, **Học lại** thì rơi về hộp 0 và quay lại ngay trong buổi. Trả lời
sai một câu trắc nghiệm sinh từ thẻ cũng kéo thẻ đó về hộp 0.

Tiến độ lưu bằng `localStorage`, không rời khỏi máy. Trang **Tiến độ** có nút xuất ra JSON và nạp lại,
dùng khi đổi máy hoặc trước khi xoá dữ liệu duyệt web.

## Thêm một bộ thẻ mới

1. Tạo `data/cards/<id>.json` theo mẫu ở trên.
2. Thêm một mục vào mảng `decks` của `data/manifest.json`, gồm `id`, `file`, `title`, `icon`,
   `lang` (`en-vi` hoặc `ru-vi`), `blurb`, `color`, và `group` là một trong các nhóm đang có:
   `telecom`, `compute`, `build`, `career`, `language`. Trang chính gom thẻ theo nhóm này.
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

Học khái niệm: `←` và `→` lùi hoặc tiến mà không chấm, `space` lật thẻ, `1` học lại,
`2` còn ngập ngừng, `3` thuộc.
Trắc nghiệm: `1` đến `4` chọn đáp án, `enter` sang câu kế.

Hai phím mũi tên chỉ để đi lại trong lượt, chúng không đụng vào lịch ôn. Lịch ôn chỉ đổi khi bạn
bấm một trong ba nút chấm.
