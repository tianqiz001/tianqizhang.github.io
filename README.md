# Mercu / Tianqi Zhang：个人网站使用说明

这是一个纯静态网站（HTML + CSS + JavaScript），不需要服务器，也不需要写代码就能更新内容。

- **网站托管**：GitHub Pages（免费），之后可以绑定你自己的域名
- **后台编辑**：Pages CMS（免费），用网页表单修改文字、上传音频、视频和图片
- **中英文切换**：页面右上角的 `EN / 中` 按钮；每段内容在后台都有英文和中文两栏

---

## 文件结构

```
index.html            页面结构
assets/style.css      所有样式（颜色在最上面的 :root 里）
assets/app.js         交互：大标题、播放器、语言切换、自动封面
content/works.json    作品列表（后台的 “Works / 作品”）
content/site.json     简介、联系方式、经历（后台的 “Profile & About / 简介与网站信息”）
media/                你上传的音频、视频、图片都会存放在这里
.pages.yml            后台编辑器的配置
.nojekyll             让 GitHub Pages 原样发布所有文件，不要删
```

`media/` 里以 `example-` 开头的文件和 `works.json` 里标着 “(example) / 示例” 的条目都是演示用的，换成你自己的作品后可以删掉。

---

## 第一步：把网站放上 GitHub（约 10 分钟，只做一次）

1. 注册并登录 [github.com](https://github.com)。
2. 右上角 **+** → **New repository**。
   - 仓库名推荐填 `你的用户名.github.io`（例如 `mercu.github.io`），这样网址最简洁。
   - 选 **Public**，点 **Create repository**。
3. 在新仓库页面点 **uploading an existing file**，把解压后文件夹里的**全部内容**拖进去，然后点 **Commit changes**。
   - ⚠️ `.pages.yml` 和 `.nojekyll` 是隐藏文件。Mac 上在 Finder 里按 `Cmd + Shift + .` 就能显示出来，记得一起拖进去。
   - 如果拖拽不方便，可以安装 [GitHub Desktop](https://desktop.github.com)，把文件夹添加为仓库后点 Publish。
4. 进入仓库的 **Settings → Pages**：
   - Source 选 **Deploy from a branch**
   - Branch 选 **main**，文件夹选 **/ (root)**，点 **Save**
5. 等 1–2 分钟，页面顶部会出现网址：
   - 仓库名是 `用户名.github.io` → `https://用户名.github.io`
   - 其他仓库名 → `https://用户名.github.io/仓库名/`

---

## 第二步：打开后台编辑器（只做一次）

1. 打开 [app.pagescms.org](https://app.pagescms.org)，用 GitHub 账号登录。
2. 按提示把 Pages CMS 的 GitHub App 安装到你的账号，并授权给这个网站仓库。
3. 打开仓库，左侧会出现两个栏目：
   - **Works / 作品**：作品列表
   - **Profile & About / 简介与网站信息**：大标题、简介、邮箱、社交链接、经历

以后更新网站，只需要打开 app.pagescms.org → 改内容 → **Save**。保存后 GitHub Pages 会自动重新发布，大约 1 分钟后网站就会更新（如果没变化，浏览器强制刷新一下）。

---

## 日常操作

### 添加一个作品
1. 后台 **Works / 作品** → 列表底部点 **Add an entry**（或类似的“添加”按钮）。
2. 填写英文标题和中文标题，选择类别、年份。
3. 在 **Media / 播放方式** 中选一种，然后填写对应的一栏：

| 播放方式 | 填写哪一栏 | 适合 |
| --- | --- | --- |
| Audio file / 上传音频 | 音频文件 | 配乐片段、电子作品、音乐会录音 |
| Video file / 上传视频 | 视频文件 | 短的演奏视频、乐器演示（建议小于 50MB） |
| YouTube / Vimeo / Bilibili | 视频链接 | 长视频、完整短片、配乐集锦 |
| No media / 无播放 | 外部链接（可选） | 只展示文字，或者跳转到其他网站 |

4. 封面图可以不上传，网站会根据标题自动生成一张波形图案作为封面。
5. 打开 **Featured / 大窗展示**，这个作品会显示成一个大窗口。
6. 打开 **Hide / 隐藏**，作品暂时不会显示，相当于草稿。
7. 作品在页面上的顺序就是后台列表里的顺序，拖动条目即可调整。

### 修改简介、邮箱、链接
后台 **Profile & About / 简介与网站信息**。“关于”这一栏里，段落之间空一行；第一段会用较大的字号显示。

### 修改大标题和中文名
同样在 **Profile & About** 中修改 “Big name, line 1 / line 2” 和 “中文名”。

### 上传照片
**Profile & About → Photo / 照片**，上传一张竖版照片（4:5 比例最好）。照片显示在“关于”区域的小窗里，平时是蓝绿色调，鼠标移上去会显示原色。

### 社交链接
**Profile & About → Links / 社交链接**，每一条都有英文名称、中文名称和链接。小红书、抖音的链接，可以在 App 里打开你的主页 → 分享 → 复制链接，再粘贴进来。

---

## 媒体文件建议

- **音频**：导出为 MP3（256–320 kbps）或 AAC/M4A，一首作品通常 5–15MB。WAV 文件太大，不建议上传。
- **视频**：MP4（H.264），尽量小于 50MB。GitHub 单个文件的上限是 100MB，而且整个仓库最好不要超过 1GB。
- **长视频**：放在 YouTube、Vimeo 或 B站，然后在后台粘贴链接。
- **国内访问**：中国大陆打不开 YouTube，GitHub Pages 在国内有时也比较慢。如果你很在意国内观众，视频优先用 B站链接。
- **封面图**：JPG 或 WebP，宽度 1600px 左右就够了。

---

## 第三步（可选）：绑定自己的域名

1. 在域名商（Cloudflare、Namecheap、阿里云等）买一个域名，例如 `mercu.com`。
2. GitHub 仓库 → **Settings → Pages → Custom domain**，填入你的域名，点 **Save**。
3. 在域名商的 DNS 设置里添加记录：
   - 4 条 **A** 记录，主机名 `@`，分别指向
     `185.199.108.153`、`185.199.109.153`、`185.199.110.153`、`185.199.111.153`
   - 1 条 **CNAME** 记录，主机名 `www`，指向 `你的用户名.github.io`
4. 等待 DNS 生效（几分钟到几小时不等），回到 Settings → Pages，勾选 **Enforce HTTPS**。

具体操作以 GitHub 官方文档为准：搜索 “GitHub Pages custom domain”。

---

## 在自己电脑上预览

直接双击 `index.html` 时，浏览器会禁止页面读取 `content/` 里的文件，所以作品列表不会显示。请在网站文件夹里打开终端，运行：

```bash
python3 -m http.server 8000
```

然后在浏览器打开 <http://localhost:8000>。

---

## 进阶修改

- **主题颜色**：`assets/style.css` 最上面的 `:root`。`--abyss` 是深色背景，`--teal` 是主色，`--glow` 是亮色点缀，`--paper` 是浅色纸面。
- **作品类别**：如果要增加新的类别，需要改两个地方：`.pages.yml` 里 `category` 的选项，以及 `assets/app.js` 顶部的 `CATS`（中英文名称）。
- **界面文字**（按钮、导航等）：`assets/app.js` 顶部的 `UI`。
- **大标题互动**：鼠标经过名字时，靠近的字母会变细变窄并亮起；播放音频时，每个字母会对应一段频率，随音乐律动。打开 “Sound on” 后，鼠标在顶部区域移动就能演奏（横向控制音高，纵向控制音量）。
