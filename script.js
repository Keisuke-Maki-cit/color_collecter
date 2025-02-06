document.getElementById('imageInput').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();

        // 読み込み開始時に進捗バーを表示
        reader.onloadstart = function() {
            document.getElementById('loadingProgressContainer').style.display = 'block';
            updateProgress(0); // 初期状態で進捗バーを0%に設定
        };

        // 進捗表示を開始
        reader.onprogress = function(e) {
            if (e.lengthComputable) {
                const progress = (e.loaded / e.total) * 100;
                updateProgress(progress); // 進捗バーを更新
            }
        };

        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const uploadedImage = document.getElementById('uploadedImage');
                uploadedImage.src = e.target.result;
                uploadedImage.style.display = 'block'; // 画像を表示
        
                // 元画像タイトルを表示
                document.getElementById('uploadedImageTitle').classList.remove('hidden');
        
                // 「生成されたカラーパレット」は非表示のまま
                document.getElementById('paletteTitle').classList.add('hidden');
        
                document.getElementById('analyzeButton').disabled = false; // 解析ボタンを有効化
                document.getElementById('analyzeButton').onclick = function() {
                    extractColors(img);
                };
        
                // 読み込み完了後に進捗バーを非表示
                document.getElementById('loadingProgressContainer').style.display = 'none';
            };
            img.src = e.target.result;
            updateProgress(100); // 読み込み完了後に進捗を100%に設定
        };

        reader.readAsDataURL(file);
    }
});

// 進捗バーを更新する関数
function updateProgress(value) {
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');  // 修正: 正しいIDを使用

    progressBar.style.width = `${value}%`;

    if (value === 0) {
        progressText.textContent = '『ファイルをアップロード』ボタンから画像をアップロードしてください';
    } else if (value === 100) {
        progressText.textContent = '読み込み完了';
    } else {
        progressText.textContent = `${value}%`;
    }
}

function extractColors(image) {
    console.log("extractColors: 処理開始"); // デバッグログ

    const canvas = document.getElementById('imageCanvas');
    const ctx = canvas.getContext('2d');

    canvas.width = image.width;
    canvas.height = image.height;
    ctx.drawImage(image, 0, 0, image.width, image.height);

    const imageData = ctx.getImageData(0, 0, image.width, image.height);
    const data = imageData.data;
    const colorCounts = {};
    const totalPixels = data.length / 4; // ピクセル数の合計

    console.log("extractColors: ピクセルデータ取得完了");

    // 進捗の表示を初期化
    let progress = 0;
    updateProgress(progress);

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const hexColor = rgbToHex(r, g, b);

        if (!colorCounts[hexColor]) {
            colorCounts[hexColor] = 0;
        }
        colorCounts[hexColor]++;

        // 進捗を更新
        progress = Math.floor((i / data.length) * 100);
        updateProgress(progress);
    }

    console.log("extractColors: 色カウント完了");

    // 色を出現回数順にソート
    const sortedColors = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]);
    console.log("extractColors: ソート完了", sortedColors);

    // 近い色を一色にまとめ、空いたパレットに他の色を繰り上げて適用
    const mergedColors = mergeSimilarColors(sortedColors);
    console.log("extractColors: 近似色マージ完了", mergedColors);

    // 最も頻出する色の上位10個を取得し、パーセンテージ計算
    const colors = [];
    let totalColorCount = 0;
    for (let i = 0; i < 10; i++) {
        if (mergedColors[i]) {
            colors.push({
                color: mergedColors[i][0],
                count: mergedColors[i][1],
            });
            totalColorCount += mergedColors[i][1];
        }
    }

    console.log("extractColors: 上位10色取得完了", colors);

    // 各色の占有率を計算
    colors.forEach(colorObj => {
        colorObj.percentage = ((colorObj.count / totalPixels) * 100).toFixed(2);
    });

    // パレット表示
    displayPalette(colors);

    // カラーボックス生成後に「生成されたカラーパレット」を表示
    document.getElementById('paletteTitle').classList.remove('hidden');

    // 解析完了時に進捗を100%に
    updateProgress(100);

    // 解析終了後にリセットボタンを表示
    document.getElementById('resetButton').style.display = 'inline';
    document.getElementById('resetButton').onclick = resetTool;

    console.log("extractColors: 処理終了");
}

function mergeSimilarColors(colorArray) {
    const threshold = 30; // 色の類似性のしきい値
    const merged = [];

    colorArray.forEach(colorEntry => {
        const [hex, count] = colorEntry;
        let mergedToExisting = false;

        for (let i = 0; i < merged.length; i++) {
            if (areColorsSimilar(hex, merged[i][0], threshold)) {
                merged[i][1] += count;
                mergedToExisting = true;
                break;
            }
        }

        if (!mergedToExisting) {
            merged.push([hex, count]);
        }
    });

    // ソートして繰り上げ
    return merged.sort((a, b) => b[1] - a[1]);
}

function areColorsSimilar(hex1, hex2, threshold) {
    const rgb1 = hexToRgb(hex1);
    const rgb2 = hexToRgb(hex2);
    const distance = Math.sqrt(
        Math.pow(rgb1.r - rgb2.r, 2) + 
        Math.pow(rgb1.g - rgb2.g, 2) + 
        Math.pow(rgb1.b - rgb2.b, 2)
    );
    return distance < threshold;
}

function displayPalette(colors) {
    const paletteDiv = document.getElementById('palette');
    paletteDiv.innerHTML = ''; // 既存の色をクリア

    colors.forEach(colorObj => {
        const colorBox = document.createElement('div');
        colorBox.className = 'color-box';
        colorBox.style.backgroundColor = colorObj.color;

        // 明度を計算して文字色を設定
        const textColor = getBrightness(colorObj.color) < 128 ? 'white' : 'black';

        // カラーコードの追加
        const colorCode = document.createElement('div');
        colorCode.className = 'color-code';
        colorCode.textContent = colorObj.color;
        colorCode.style.color = textColor; // 文字色を設定

        // 占有率ゲージバーの追加
        const percentageDisplay = document.createElement('div');
        percentageDisplay.className = 'color-percentage';
        percentageDisplay.textContent = `${colorObj.percentage}%`;
        percentageDisplay.style.color = textColor; // 文字色を設定

        const percentageBar = document.createElement('div');
        percentageBar.className = 'percentage-bar';

        // ゲージバーの色をパレットの色に合わせる
        const percentageFill = document.createElement('div');
        percentageFill.className = 'percentage-fill';
        percentageFill.style.width = `${colorObj.percentage}%`;
        percentageFill.style.backgroundColor = colorObj.color; // ゲージバーの色を設定
        percentageBar.appendChild(percentageFill);

        // 明度に応じて枠線の色を設定
        if (getBrightness(colorObj.color) < 128) {
            percentageBar.classList.add('with-light-border'); // 暗い色には白い枠線
        } else {
            percentageBar.classList.add('with-dark-border'); // 明るい色には黒い枠線
        }

        // カラーコードのクリックでコピー
        colorCode.addEventListener('click', function() {
            // カラーコードが `#------` の場合、コピー処理を無効化
            if (colorObj.color === "#------") {
                return; // コピー処理をスキップ
            }
            copyToClipboard(colorObj.color); // コピー処理を実行
        });

        colorBox.appendChild(colorCode);
        colorBox.appendChild(percentageBar); // ゲージバーを追加
        colorBox.appendChild(percentageDisplay); // 占有率をカラー枠の下に配置
        paletteDiv.appendChild(colorBox);
    });
}

// 色の明度を取得する関数
function getBrightness(hex) {
    const rgb = hexToRgb(hex);
    // 明度計算: 輝度の計算式 Y = 0.299*R + 0.587*G + 0.114*B
    return 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
}

// RGBを16進数カラーコードに変換する関数
function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    }).join('');
}

// 16進数のカラーコードをRGBに変換する関数
function hexToRgb(hex) {
    const bigint = parseInt(hex.slice(1), 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return { r, g, b };
}

// 進捗バーを更新する関数
function updateProgress(value) {
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');

    // 進捗バーの幅を更新
    progressBar.style.width = `${value}%`;

    // 進捗テキストを条件に応じて更新
    if (value === 0) {
        progressText.textContent = '『ファイルをアップロード』ボタンから画像をアップロードしてください';
    } else if (value === 100) {
        progressText.textContent = '読み込み完了';
    } else {
        progressText.textContent = `${value}%`;
    }
}

// カラーコードをクリップボードにコピーする関数
function copyToClipboard(text) {
    // 先頭の「#」を取り除く
    const colorWithoutHash = text.startsWith('#') ? text.slice(1) : text;

    const tempInput = document.createElement('input');
    tempInput.value = colorWithoutHash;  // 「#」を取り除いたカラーコードを設定
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);

    alert('カラーコードがコピーされました: ' + colorWithoutHash);
}

// リセット機能
function resetTool() {
    const paletteDiv = document.getElementById('palette');
    paletteDiv.innerHTML = ''; // パレットを完全クリア

    for (let i = 0; i < 10; i++) {
        const colorBox = document.createElement('div');
        colorBox.className = 'color-box';
        colorBox.style.backgroundColor = '#808080'; // 灰色

        const colorCode = document.createElement('div');
        colorCode.className = 'color-code';
        colorCode.textContent = '#------'; // 初期値
        colorCode.style.color = 'white';

        const percentageDisplay = document.createElement('div');
        percentageDisplay.className = 'color-percentage';
        percentageDisplay.textContent = '-.-%'; // 初期値
        percentageDisplay.style.color = 'white';

        const percentageBar = document.createElement('div');
        percentageBar.className = 'percentage-bar';
        const percentageFill = document.createElement('div');
        percentageFill.className = 'percentage-fill';
        percentageFill.style.width = '0%'; // 初期値
        percentageBar.appendChild(percentageFill);

        colorBox.appendChild(colorCode);
        colorBox.appendChild(percentageBar);
        colorBox.appendChild(percentageDisplay);
        paletteDiv.appendChild(colorBox);
    }

    document.getElementById('imageInput').value = ''; // ファイル選択リセット
    document.getElementById('uploadedImage').style.display = 'none'; // アップロード画像を非表示
    document.getElementById('uploadedImageTitle').classList.add('hidden'); // 「元画像」タイトルを非表示

    document.getElementById('analyzeButton').disabled = true; // 解析ボタン無効化
    document.getElementById('resetButton').style.display = 'none'; // リセットボタン非表示
    updateProgress(0); // プログレスバーをリセット
}

//img.onerror = function() {
//    alert("画像の読み込みに失敗しました。再度試してください。");
//};

// 使い方ポップアップの表示/非表示のロジック
document.addEventListener('DOMContentLoaded', function () {
    const helpButton = document.getElementById('help-button');
    const helpPopup = document.getElementById('help-popup');
    const closeButton = document.getElementById('close-popup');

    // ポップアップを表示
    helpButton.addEventListener('click', function () {
        helpPopup.style.display = 'flex';
    });

    // ポップアップを閉じる
    closeButton.addEventListener('click', function () {
        helpPopup.style.display = 'none';
    });

    // オーバーレイをクリックしても閉じる
    helpPopup.addEventListener('click', function (event) {
        if (event.target === helpPopup) { // 背景部分をクリックした場合のみ閉じる
            helpPopup.style.display = 'none';
        }
    });
});