import { SubjectData } from '../types';

export const englishGrade1Curriculum: SubjectData = {
  name: '英語',
  code: 'english',
  units: [
    {
      name: 'アルファベットとあいさつ',
      order: 1,
      description: '英語の世界へようこそ！文字と基本のあいさつをマスターしよう。',
      lessons: [
        {
          name: 'アルファベットと言葉のルール',
          order: 1,
          questions: [
            {
              id: 'english-g1-u1-l1-001',
              type: 'FILL_IN_BLANK',
              prompt: 'アルファベットの「A」の小文字を書きなさい。',
              answers: ['a'],
              options: [],
              explanation: '「A」の小文字は「a」です。',
              hints: [
                'りんご（apple）の頭文字だよ。',
                'まあるく書いてから、右側に小さな棒をつける文字だよ。',
                'キーボードの「A」と同じ位置にある「a」を入力してね。'
              ]
            },
            {
              id: 'english-g1-u1-l1-002',
              type: 'MULTIPLE_CHOICE',
              prompt: '朝のあいさつとして最も適切なものを選びなさい。',
              answers: ['Good morning'],
              options: ['Good morning', 'Good afternoon', 'Good evening', 'Good bye'],
              explanation: '朝は「Good morning」、昼は「Good afternoon」、夜は「Good evening」と言います。',
              hints: [
                '「モーニング」という言葉が含まれるあいさつだよ。',
                '朝食のことをモーニングコールとか言うよね。',
                '「Good morning」を選ぼう。'
              ]
            },
            {
              id: 'english-g1-u1-l1-003',
              type: 'FILL_IN_BLANK',
              prompt: '「はじめまして」を表す英語 “Nice to [ ] you.” の空欄に入る単語を書きなさい。',
              answers: ['meet'],
              options: [],
              explanation: '“Nice to meet you.” で「あなたに会えて嬉しいです（はじめまして）」という意味になります。',
              hints: [
                '「会う」という意味の単語だよ。',
                'mから始まる4文字の単語だよ。m - e - e - ...？',
                '「meet」と書こう！'
              ]
            },
            {
              id: 'english-g1-u1-l1-004',
              type: 'FILL_IN_BLANK',
              prompt: '「ありがとう」を表す英語 “Thank [ ].” の空欄に入る単語を書きなさい。',
              answers: ['you'],
              options: [],
              explanation: '“Thank you.” で「ありがとう」という意味になります。',
              hints: [
                '「あなた」を表す単語が入るよ。',
                'yから始まる3文字の単語だよ。y - o - ...？',
                '「you」と書こう！'
              ]
            },
            {
              id: 'english-g1-u1-l1-005',
              type: 'MULTIPLE_CHOICE',
              prompt: '別れ際のあいさつとして最も適切なものを選びなさい。',
              answers: ['Good bye'],
              options: ['Good morning', 'Good bye', 'Hello', 'Thank you'],
              explanation: '別れるときは「Good bye（さようなら）」と言います。',
              hints: [
                'バイバイ、という言葉が含まれるあいさつだよ。',
                'gから始まる言葉だよ。',
                '「Good bye」を選ぼう。'
              ]
            },
            {
              id: 'english-g1-u1-l1-006',
              type: 'FILL_IN_BLANK',
              prompt: '「こんにちは」を表す英語 “[ ]” を大文字から始めて書きなさい。',
              answers: ['Hello'],
              options: [],
              explanation: '「こんにちは」は「Hello」です。',
              hints: [
                'ハロー、と発音するよ。',
                'Hから始まる5文字の単語だよ。H - e - l - l - ...？',
                '「Hello」と書こう！'
              ]
            },
            {
              id: 'english-g1-u1-l1-007',
              type: 'MULTIPLE_CHOICE',
              prompt: '「私はケンです。」を表す英文 “I am [ ].” に入る適切な言葉を選びなさい。',
              answers: ['Ken'],
              options: ['Ken', 'ken', 'KEN', 'Kens'],
              explanation: '人名は最初の文字を大文字にするルールがあります。したがって「Ken」が適切です。',
              hints: [
                '英語の「名前（固有名詞）」は、最初の文字をどう書くルールだったかな？',
                '最初の文字を「大文字」にするよ。',
                'Kが大文字になっている「Ken」を選ぼう。'
              ]
            },
            {
              id: 'english-g1-u1-l1-008',
              type: 'FILL_IN_BLANK',
              prompt: '「英語」を表す英単語 “[ ]” を大文字から始めて書きなさい。',
              answers: ['English'],
              options: [],
              explanation: '「英語」は「English」と書きます。言語名なので最初の文字は大文字にします。',
              hints: [
                'イングリッシュ、と発音するよ。',
                'Eから始まる7文字の単語だよ。E - n - g - l - i - s - h だね。',
                '「English」と入力しよう！'
              ]
            },
            {
              id: 'english-g1-u1-l1-009',
              type: 'FILL_IN_BLANK',
              prompt: '英語の文の終わりにつける「.」の記号の名前を、カタカナで書きなさい。',
              answers: ['ピリオド'],
              options: [],
              explanation: '文の終わりにつける「.」は「ピリオド」と呼びます。',
              hints: [
                '「ピ」から始まる4文字のカタカナだよ。',
                '日本語の「。」（くてん）にあたるものだね。',
                '「ピリオド」だよ。'
              ]
            },
            {
              id: 'english-g1-u1-l1-010',
              type: 'MULTIPLE_CHOICE',
              prompt: '疑問文（たずねる文）の終わりにつける正しい記号を選びなさい。',
              answers: ['?'],
              options: ['.', '?', '!', ','],
              explanation: '疑問文の最後にはクエスチョンマーク「?」をつけます。',
              hints: [
                'はてなマークのことだよ.。。',
                '質問するときに使うマークを選んでね。',
                '「?」を選ぼう！'
              ]
            }
          ]
        }
      ]
    },
    {
      name: 'be動詞 (am, is, are)',
      order: 2,
      description: '「〜です」「〜にいます」を表すbe動詞の使い方をマスターしよう！',
      lessons: [
        {
          name: '主語とbe動詞の組み合わせ',
          order: 1,
          questions: [
            {
              id: 'english-g1-u2-l1-001',
              type: 'FILL_IN_BLANK',
              prompt: '“I [ ] a student.” の空欄に入るbe動詞を書きなさい。',
              answers: ['am'],
              options: [],
              explanation: '主語が「I（私）」のときのbe動詞は「am」です。',
              hints: [
                '「アイ・アム・ア・スチューデント」と言うよね。',
                'Iとセットになるbe動詞は1つしかないよ。',
                '「am」と入力しよう。'
              ]
            },
            {
              id: 'english-g1-u2-l1-002',
              type: 'FILL_IN_BLANK',
              prompt: '“You [ ] kind.” の空欄に入るbe動詞を書きなさい。',
              answers: ['are'],
              options: [],
              explanation: '主語が「You（あなた）」のときのbe動詞は「are」です。',
              hints: [
                '「ユー・アー・カインド」と言うよね。',
                'Youとセットになるbe動詞を思い出そう。',
                '「are」と入力しよう。'
              ]
            },
            {
              id: 'english-g1-u2-l1-003',
              type: 'FILL_IN_BLANK',
              prompt: '“He [ ] my friend.” の空欄に入るbe動詞を書きなさい。',
              answers: ['is'],
              options: [],
              explanation: '主語が「He（彼）」のときのbe動詞は「is」です。',
              hints: [
                '「ヒー・イズ・マイ・フレンド」と言うよね。',
                '三人称単数の主語（He, She, Itなど）のときのbe動詞は何だったかな？',
                '「is」と入力しよう。'
              ]
            },
            {
              id: 'english-g1-u2-l1-004',
              type: 'FILL_IN_BLANK',
              prompt: '“She [ ] a doctor.” の空欄に入るbe動詞を書きなさい。',
              answers: ['is'],
              options: [],
              explanation: '主語が「She（彼女）」のときのbe動詞は「is」です。',
              hints: [
                'Sheは一人（三人称単数）なので、Heと同じbe動詞を使うよ。',
                '「シー・イズ・ア・ドクター」と言うよ。',
                '「is」と入力しよう。'
              ]
            },
            {
              id: 'english-g1-u2-l1-005',
              type: 'FILL_IN_BLANK',
              prompt: '“They [ ] soccer players.” の空欄に入るbe動詞を書きなさい。',
              answers: ['are'],
              options: [],
              explanation: '主語が「They（彼ら）」の複数形のときのbe動詞は「are」です。',
              hints: [
                '主語が「複数（2人以上、2つ以上）」のときのbe動詞は何だったかな？',
                'Theyは「彼ら」という意味で複数形だね。Youと同じ動詞を使うよ。',
                '「are」と入力しよう。'
              ]
            },
            {
              id: 'english-g1-u2-l1-006',
              type: 'MULTIPLE_CHOICE',
              prompt: '「これは私の本です。」を表す英文として正しいものを選びなさい。',
              answers: ['This is my book.'],
              options: ['This is my book.', 'This am my book.', 'This are my book.', 'This my book.'],
              explanation: 'This（これ）は単数形なのでbe動詞は「is」が適切です。「This is my book.」となります。',
              hints: [
                'Thisは「これ」という意味で、1つのものを指すよ。',
                '単数を指す言葉のbe動詞は「is」だね。',
                '「This is my book.」を選おう。'
              ]
            },
            {
              id: 'english-g1-u2-l1-007',
              type: 'MULTIPLE_CHOICE',
              prompt: '「私は忙しくありません。」を表す英文として正しいものを選びなさい。',
              answers: ['I am not busy.'],
              options: ['I am not busy.', 'I not am busy.', 'I am no busy.', 'I don\'t busy.'],
              explanation: 'be動詞の否定文は、be動詞の直後に「not」を置きます。「I am not busy.」となります。',
              hints: [
                '「〜ではない」という否定の言葉「not」を置く場所に注目しよう。',
                'notはbe動詞（am）の後ろに置くのがルールだよ。',
                '「I am not busy.」を選ぼう。'
              ]
            },
            {
              id: 'english-g1-u2-l1-008',
              type: 'FILL_IN_BLANK',
              prompt: '“Is he a teacher?” に対する答えで、「はい、そうです。」を表す “Yes, he [ ].” の空欄に入る単語を書きなさい。',
              answers: ['is'],
              options: [],
              explanation: '“Is he ~?” で聞かれたら、“Yes, he is.” で答えます。',
              hints: [
                '質問で「Is he ~?」と「is」を使っているから、答えるときも同じ動詞を使うよ。',
                'Yes, he [is]. となるね。',
                '「is」と書こう！'
              ]
            },
            {
              id: 'english-g1-u2-l1-009',
              type: 'FILL_IN_BLANK',
              prompt: '“Are you happy?” に対する答えで、「いいえ、違います。」を表す “No, I [ ] not.” の空欄に入る単語を書きなさい。',
              answers: ['am'],
              options: [],
              explanation: '“Are you ~?” （あなたは〜ですか？）と聞かれているので、「私は〜です」と答えるため、“No, I am not.” となります。',
              hints: [
                '「あなたは〜ですか？」と聞かれたら、「私は〜です/ではありません」と答えるよね。',
                'だから主語は「I」になるよ。Iのbe動詞を思い出そう。',
                '「am」と書こう！'
              ]
            },
            {
              id: 'english-g1-u2-l1-010',
              type: 'MULTIPLE_CHOICE',
              prompt: '「あなたはテニス選手ですか？」を表す英文として正しいものを選びなさい。',
              answers: ['Are you a tennis player?'],
              options: ['Are you a tennis player?', 'You are a tennis player?', 'Is you a tennis player?', 'Do you a tennis player?'],
              explanation: 'be動詞の疑問文は、主語とbe動詞を入れ替えます。「Are you a tennis player?」となります。',
              hints: [
                '普通の文「You are ~」の主語と動詞をひっくり返すよ。',
                'Areを文の先頭に出して、最後に「?」をつけるんだ。',
                '「Are you a tennis player?」を選ぼう。'
              ]
            }
          ]
        }
      ]
    },
    {
      name: '一般動詞 (like, play, study)',
      order: 3,
      description: '動作や状態を表す「一般動詞」の使い方と、否定文・疑問文に挑戦！',
      lessons: [
        {
          name: '一般動詞の基本と文のつくりかた',
          order: 1,
          questions: [
            {
              id: 'english-g1-u3-l1-001',
              type: 'FILL_IN_BLANK',
              prompt: '「私は野球をします。」を表す英文 “I [ ] baseball.” の空欄に入る動詞を書きなさい。',
              answers: ['play'],
              options: [],
              explanation: 'スポーツをする、楽器を演奏する、などを表す動詞は「play」です。',
              hints: [
                'スポーツをするときに使うおなじみの動詞だよ。',
                'pから始まる4文字の単語だよ。p - l - a - ...？',
                '「play」と入力しよう！'
              ]
            },
            {
              id: 'english-g1-u3-l1-002',
              type: 'FILL_IN_BLANK',
              prompt: '「私は犬が好きです。」を表す英文 “I [ ] dogs.” の空欄に入る動詞を書きなさい。',
              answers: ['like'],
              options: [],
              explanation: '「〜が好きである」を表す動詞は「like」です。',
              hints: [
                '「いいね！」の意味でもよく使われる動詞だよ。',
                'lから始まる4文字の単語だよ。l - i - k - ...？',
                '「like」と入力しよう！'
              ]
            },
            {
              id: 'english-g1-u3-l1-003',
              type: 'FILL_IN_BLANK',
              prompt: '「私は毎日英語を勉強します。」を表す英文 “I [ ] English every day.” の空欄に入る動詞を書きなさい。',
              answers: ['study'],
              options: [],
              explanation: '「勉強する」を表す動詞は「study」です。',
              hints: [
                'スタディ、と発音するよ。',
                'sから始まる5文字の単語だよ。s - t - u - d - ...？',
                '「study」と入力しよう！'
              ]
            },
            {
              id: 'english-g1-u3-l1-004',
              type: 'FILL_IN_BLANK',
              prompt: '「私は車を持っています。」を表す英文 “I [ ] a car.” の空欄に入る動詞を書きなさい。',
              answers: ['have'],
              options: [],
              explanation: '「持っている、所有している」を表す動詞は「have」です。',
              hints: [
                'ハブ、と発音するよ。',
                'hから始まる4文字の単語だよ。h - a - v - ...？',
                '「have」と入力しよう！'
              ]
            },
            {
              id: 'english-g1-u3-l1-005',
              type: 'MULTIPLE_CHOICE',
              prompt: '「私はリンゴを食べます。」を表す正しい英文を選びなさい。',
              answers: ['I eat an apple.'],
              options: ['I eat an apple.', 'I eats an apple.', 'I eating an apple.', 'I am eat an apple.'],
              explanation: '主語がI（私）なので動詞は原型の「eat」にします。また「am」と「eat」を同時に並べることはできません。「I eat an apple.」となります。',
              hints: [
                '「食べる」は英語で「eat」だね。',
                '主語は「I」なので、そのまま「eat」を使うよ。「am」はいらないよ。',
                '「I eat an apple.」を選ぼう。'
              ]
            },
            {
              id: 'english-g1-u3-l1-006',
              type: 'MULTIPLE_CHOICE',
              prompt: '「私はテニスをしません。」を表す正しい英文を選びなさい。',
              answers: ['I do not play tennis.'],
              options: ['I do not play tennis.', 'I not play tennis.', 'I am not play tennis.', 'I play not tennis.'],
              explanation: '一般動詞の否定文では、動詞の前に「do not」または短縮形の「don\'t」を置きます。「I do not play tennis.」となります。',
              hints: [
                '一般動詞（playなど）の否定文では、お助けキャラの「do」が登場するよ。',
                '「do not (don\'t)」を動詞の前に置くんだ。',
                '「I do not play tennis.」を選ぼう。'
              ]
            },
            {
              id: 'english-g1-u3-l1-007',
              type: 'MULTIPLE_CHOICE',
              prompt: '「あなたは音楽が好きですか？」を表す正しい英文を選びなさい。',
              answers: ['Do you like music?'],
              options: ['Do you like music?', 'Are you like music?', 'Like you music?', 'You like music?'],
              explanation: '一般動詞の疑問文では、文頭に「Do」を置き、動詞は原型のままにします。「Do you like music?」となります。',
              hints: [
                '一般動詞（like）の疑問文でも、お助けキャラ「Do」が文の先頭にくるよ。',
                '「Do you + 動詞の原形 ~?」の形になるね。',
                '「Do you like music?」を選ぼう。'
              ]
            },
            {
              id: 'english-g1-u3-l1-008',
              type: 'FILL_IN_BLANK',
              prompt: '“Do you play the piano?” に対する答えで、「はい、弾きます。」を表す “Yes, I [ ].” の空欄に入る単語を書きなさい。',
              answers: ['do'],
              options: [],
              explanation: '“Do you ~?” で聞かれたら、“Yes, I do.” または “No, I don\'t.” で答えます。',
              hints: [
                '「Do」で聞かれた質問には、「do」を使って答えるよ。',
                'Yes, I [do]. だね。',
                '「do」と書こう！'
              ]
            },
            {
              id: 'english-g1-u3-l1-009',
              type: 'FILL_IN_BLANK',
              prompt: '“Do you like grapes?” に対する答えで、「いいえ、好きではありません。」を表す “No, I [ ].” の空欄に入る短縮形の単語（1語）を書きなさい。',
              answers: ['don\'t', 'dont'],
              options: [],
              explanation: '“Do you ~?” に対する否定の答えは “No, I do not.” または短縮形の “No, I don\'t.” です。',
              hints: [
                'do と not が合体した短縮形を思い出そう。',
                'd - o - n - \' - t と書くよ。アポストロフィ（\'）を忘れずにね。',
                '「don\'t」と書こう！'
              ]
            },
            {
              id: 'english-g1-u3-l1-010',
              type: 'MULTIPLE_CHOICE',
              prompt: '「あなたは何を持っていますか？」を表す正しい英文を選びなさい。',
              answers: ['What do you have?'],
              options: ['What do you have?', 'What have you?', 'What you have?', 'What do you has?'],
              explanation: '「何を〜ですか」と聞くときは、疑問詞「What」を文頭に置き、その後に疑問文の語順（do you have?）を続けます。したがって「What do you have?」が正解です。',
              hints: [
                '「何（なに）」を表す疑問詞「What」を一番前に置くよ。',
                'そのあとに「あなたは持っていますか？」という疑問文「do you have?」を続けるんだ。',
                '「What do you have?」を選ぼう。'
              ]
            }
          ]
        }
      ]
    }
  ]
};
