# Rakkyo Multi-Tenancy Architecture Design Document

将来的に塾や学校などの教育機関（テナント）へ展開し、それぞれの機関ごとに安全にデータを論理分離しつつ、管理者・教師・生徒・保護者のマルチロールによる円滑な学習管理を行えるようにするための、マルチテナント・データ分離アーキテクチャ設計書です。

---

## 1. 背景と目的

現在、Rakkyo は個人の家庭学習向け（B2C）に最適化されて構築されています。今後、全国の学習塾、フリースクール、中学校・高校などの法人・教育機関（B2B2C）へとサービスを展開するにあたり、以下の要件を満たす必要があります。

* **データの論理分離**: 各テナント（塾や学校）の生徒・保護者・教師の情報は、他のテナントから完全に隔離され、プライバシーとセキュリティが担保されていなければならない。
* **マルチロール（多重権限）のサポート**: 「システム管理者」「テナント（塾・学校）管理者」「教師」「生徒」「保護者」の5つの主要なロールを定義し、それぞれの役割に応じたダッシュボードとAPI認可制御を提供する。
* **低コストかつ高スケーラビリティ**: テナントごとに個別のデータベースサーバーを立ち上げるのではなく、単一のデータベースを共有しつつデータ論理分離を行う「共有データベース・論理分離（Shared Schema / Shared Database）」アプローチを採用し、インフラコストと運用負荷を抑える。

---

## 2. マルチテナンシーアーキテクチャの選定

マルチテナント方式には大きく分けて以下の3つがあります。

| 方式 | 概要 | メリット | デメリット | 採用判定 |
| :--- | :--- | :--- | :--- | :--- |
| **物理分離 (Database-per-Tenant)** | テナントごとに物理DBを独立 | セキュリティが最高、カスタマイズが容易 | コストが高価、マイグレーションが極めて複雑 | 不採用 (コスト過多) |
| **スキーマ分離 (Schema-per-Tenant)** | 同一DB内でスキーマを分ける | 物理分離より低コスト、ある程度の隔離性 | テナント数増加に伴う接続プール枯渇・マイグレーション複雑化 | 不採用 (運用負荷大) |
| **論理分離 (Shared Database / Row-Level)** | **全テナントで同一テーブルを共有し、`tenantId` カラムで識別** | **インフラコスト最小、構築が容易、一元的なマイグレーション** | **開発者のクエリ漏れによるデータ混入リスク** | **採用 (Prisma拡張機能で防衛)** |

> [!IMPORTANT]
> **「論理分離方式」の採用決定とリスク対策**
>
> インフラ効率と運用管理コストの最大化のため、**論理分離（Shared Database）** を採用します。懸念点である「開発者が `where: { tenantId }` を書き忘れて別テナントのデータが露出するバグ」に対しては、**Prisma Client Extensions による自動テナントフィルタリング**を導入し、アプリケーション層の基盤部分で暗黙的かつ強制的にフィルタリングを行うことで、人間によるコーディングミスを完全に防ぎます。

---

## 3. データモデル設計とスキーマ拡張

Prisma Schema における主要なエンティティとリレーションの拡張プランです。

```mermaid
erDiagram
    Tenant ||--o{ User : "belongs to"
    Tenant ||--o{ Class : "manages"
    Class ||--o{ User : "contains students/teachers"
    User ||--o{ Attempt : "records"
    User ||--o{ UserBadge : "earns"
    User ||--o{ ParentalConsent : "has"

    Tenant {
        String id PK
        String name
        String code "Unique domain prefix"
        String plan "Basic/Premium"
        DateTime createdAt
    }

    User {
        String id PK
        String tenantId FK
        String email
        String password
        String nickname
        String role "SYSTEM_ADMIN | TENANT_ADMIN | TEACHER | STUDENT | PARENT"
        Boolean parentalConsent
    }

    Class {
        String id PK
        String tenantId FK
        String name
        String grade
    }
```

### 3.1. スキーマ定義の拡張ドラフト (`schema.prisma`)

```prisma
// テナント（塾・学校）
model Tenant {
  id        String   @id @default(cuid())
  name      String
  code      String   @unique // URLサブドメインや識別用 (e.g. "shibuya-juku")
  plan      String   @default("STANDARD") // 契約プラン
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  users     User[]
  classes   Class[]

  @@index([code])
}

// ユーザー（マルチロール対応）
model User {
  id              String   @id @default(cuid())
  tenantId        String
  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  email           String
  password        String
  nickname        String
  role            Role     @default(STUDENT)
  
  // 学習ステータス
  level           Int      @default(1)
  currentXp       Int      @default(0)
  streakCount     Int      @default(0)
  lastActiveDate  DateTime?
  
  // 法務・制限関係
  parentalConsent Boolean  @default(false)
  aiHintCountToday Int     @default(0)
  lastAiHintDate  String?

  // リレーション
  attempts        Attempt[]
  badges          UserBadge[]
  classes         ClassEnrollment[]
  
  // 保護者・生徒連携用中間テーブル
  parentRelations ParentChildRelation[] @relation("ChildToParent")
  childRelations  ParentChildRelation[] @relation("ParentToChild")

  @@unique([tenantId, email]) // 同一テナント内でメールアドレスはユニーク（他テナント間であれば同じメアドの生徒が存在可能）
  @@index([tenantId])
}

enum Role {
  SYSTEM_ADMIN   // システム全体管理者（ラッキョ運営チーム）
  TENANT_ADMIN   // テナント管理者（塾長・校長）
  TEACHER        // 教師（クラス担任・教科担当）
  STUDENT        // 生徒（中学生）
  PARENT         // 保護者
}

// クラス・グループ（塾のコースや学校のクラス）
model Class {
  id          String            @id @default(cuid())
  tenantId    String
  tenant      Tenant            @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  name        String
  grade       Int               // 対象学年
  enrollments ClassEnrollment[]
  
  @@index([tenantId])
}

// クラスと所属ユーザー（生徒・教師）の中間テーブル
model ClassEnrollment {
  id        String   @id @default(cuid())
  classId   String
  class     Class    @relation(fields: [classId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  role      ClassRole @default(STUDENT) // そのクラス内での役割

  @@unique([classId, userId])
}

enum ClassRole {
  TEACHER
  STUDENT
}

// 保護者と生徒の紐づけ関係
model ParentChildRelation {
  id        String   @id @default(cuid())
  parentId  String
  parent    User     @relation("ParentToChild", fields: [parentId], references: [id], onDelete: Cascade)
  childId   String
  child     User     @relation("ChildToParent", fields: [childId], references: [id], onDelete: Cascade)

  @@unique([parentId, childId])
}
```

---

## 4. テナント分離（データアクセス制御）の実装アプローチ

論理分離方式での最大の脅威である **「開発者がテナントIDフィルタリングを忘れるバグ」** を排除するため、Prisma 4.7.0 以降でサポートされている **Prisma Client Extensions** を使用して暗黙的テナントフィルタリングをクエリ層に強制注入します。

### 4.1. Prisma Client Extension による自動フィルタリングの実装イメージ

APIサーバーでリクエストごとにテナントIDを特定し、そのスレッド（または非同期コンテキスト）に紐づいたテナントIDを Prisma クエリに自動適用します。

```typescript
import { PrismaClient } from '@prisma/client';
import { AsyncLocalStorage } from 'async_hooks';

// リクエストごとのコンテキストを追跡するストレージ
export const tenantStorage = new AsyncLocalStorage<{ tenantId: string }>();

const rawPrisma = new PrismaClient();

// テナント分離の拡張クライアント
export const prisma = rawPrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const context = tenantStorage.getStore();
        
        // テナントIDが特定できている場合のみ適用（ログイン前やシステム管理者はバイパス可能）
        if (context?.tenantId) {
          // テナントに属するモデルのリスト
          const tenantBoundModels = ['User', 'Class', 'Attempt', 'ClassEnrollment'];
          
          if (tenantBoundModels.includes(model)) {
            args.where = args.where || {};
            
            // クエリ操作に応じて自動的に tenantId フィルタリングを注入
            if (['findMany', 'findUnique', 'findFirst', 'update', 'delete', 'count'].includes(operation)) {
              args.where = {
                ...args.where,
                tenantId: context.tenantId,
              };
            } else if (operation === 'create') {
              args.data = {
                ...args.data,
                tenantId: context.tenantId,
              };
            }
          }
        }
        
        return query(args);
      },
    },
  },
});
```

> [!TIP]
> **AsyncLocalStorage によるスレッド安全なテナント注入**
> Express などのミドルウェアで JWT トークンから `tenantId` をデコードし、`tenantStorage.run({ tenantId }, () => { next(); })` の中でコントローラーを動かします。これにより、開発者がコントローラー内で明示的に `tenantId` を指定しなくても、発行される SQL には常に `AND tenantId = ?` が自動注入されます。

---

## 5. 認証・認可 (AuthN / AuthZ) の設計

### 5.1. テナント解決 (Tenant Resolution)
ユーザーがどのテナントに属しているかを特定するため、以下のいずれかのアプローチを採用します。

1. **サブドメイン解決方式 (推奨)**:
   - 例: `https://tokyo-juku.rakkyo.com` にアクセスした際、サブドメイン `tokyo-juku` をテナントコードとしてフロントエンドが認識し、APIリクエストヘッダー `X-Tenant-Code` に乗せて送信する。
2. **マルチテナント統合ログイン**:
   - メールアドレスとパスワード入力時、まずDBから該当ユーザーの `tenantId` を引き出し、ログイントークンを発行する。ただし、異なるテナントで同じメールアドレスの生徒が存在しうるため、ログイン時に「塾コード」の入力を求める設計が最も安全です。

### 5.2. JWT トークンの構造
認証に成功すると発行される JWT トークンには、テナント情報とロールを組み込みます。

```json
{
  "userId": "usr_12345",
  "tenantId": "ten_shibuya_09",
  "role": "TEACHER",
  "iat": 1716382800,
  "exp": 1716469200
}
```

### 5.3. ロールベースアクセス制御 (RBAC) ミドルウェア
Express 内で権限チェックを行うための認可ミドルウェアを整備します。

```typescript
export function requireRole(allowedRoles: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: "この操作を行う権限がありません。ラッキョくんも悲しんでいるよ 🧅" 
      });
    }
    next();
  };
}

// 適用例：クラス作成 API
router.post('/classes', authMiddleware, requireRole(['TENANT_ADMIN', 'TEACHER']), async (req, res) => {
  // 処理...
});
```

---

## 6. 保護者と生徒のテナント内連携

中学生向けである Rakkyo にとって、保護者と生徒の紐づけは非常に重要です。マルチテナント環境において、以下の法務・技術的ガイドラインを策定します。

* **同意情報のテナント内閉域**: 保護者同意フラグ (`parentalConsent`) およびその署名データは、生徒が所属するテナント内で完結させます。テナントを跨いだ同意情報の共有は行いません。
* **保護者の複数テナント紐づけ**:
  * 一人の保護者が複数の塾（例：塾Aと英語専門スクールB）に子どもを通わせている場合、それぞれの塾テナント配下で保護者ユーザーアカウントが別々に作成されます。
  * 将来的に保護者がダッシュボードをワンクリックで切り替えられるよう、同一メールアドレスのアカウントであれば、ログイン後に所属テナントをスイッチできる「マルチテナント・スイッチング」機能をダッシュボードに組み込みます。

---

## 7. 移行・デプロイ戦略

既存のシングルテナント（B2C）データを失うことなく、スムーズにマルチテナント環境へ移行するための 3 ステップです。

> [!WARNING]
> **移行時のデフォルトテナント（Default Tenant）の作成**
>
> 1. **Default Tenant のシード**: 移行開始時に、システム内に特別なデフォルトテナント（ID: `default-b2c`）を作成します。
> 2. **NULL 許容でのカラム追加**: `User` および主要テーブルに `tenantId` を最初は `Nullable` または一時的なデフォルト値 `default-b2c` としてカラム追加するマイグレーションを実行します。
> 3. **カラムの必須化**: 全データが `default-b2c` にマッピングされた後、`tenantId` カラムを `NOT NULL` に変更し、参照整合性制約（Foreign Key）を有効化します。

これにより、既存の個人向けユーザーは自動的に「デフォルト個人テナント」にマッピングされ、サービスを無停止のままマルチテナント対応システムへとアップグレードすることができます。
