// src/components/mcpCatalogData.ts
// Open Crow v2.5 — Doğrulanmış MCP Sunucuları Kataloğu (yalnızca gerçekten var olan paketler ve uzak sunucular)

import {
  logoGitHub, logoDocker, logoBrave, logoLinear, logoSequentialThinking, logoBlender, logoGodot, logoGit, logoBitbucket, logoSQLite, logoMySQL, logoMongoDB, logoSnowflake, logoQdrant, logoKubernetes, logoCloudflare, logoAzure, logoGCP, logoVercel, logoDatadog, logoExa, logoPerplexity, logoPlaywright, logoFirecrawl, logoFetch, logoNotion, logoConfluence, logoAsana, logoTodoist, logoObsidian, logoTelegram, logoWhatsApp, logoStripe, logoAirtable, logoTwilio, logoSendGrid, logoMeshy, logoReplicate, logoElevenLabs, logoHuggingFace, logoMemory, logoFilesystem, logoTime
} from './brandLogos';

export interface MCPConfigField {
  key: string;
  label: string;
  placeholder: string;
  type: 'text' | 'password';
  optional?: boolean;
  hint?: string;
}

export interface MCPConnectorDef {
  id: string;
  name: string;
  category: 'dev' | 'db' | 'design' | 'comms' | 'cloud' | 'search' | 'ai' | 'gamedev';
  categoryLabel: string;
  logo: (size?: number) => string;
  description: string;
  type: 'stdio' | 'sse' | 'http';
  defaultCommand?: string;
  defaultUrl?: string;
  toolsCount: number;
  featured?: boolean;
  authGuide?: string;
  tools: { name: string; description: string; params?: string }[];
  configFields: MCPConfigField[];
}

export const MCP_CONNECTORS_CATALOG: MCPConnectorDef[] = [
  // --- 1. GELİŞTİRİCİ & SÜRÜM KONTROL (DEV) ---
  {
    id: 'git',
    name: 'Git Local Repo MCP',
    category: 'dev',
    categoryLabel: 'Geliştirici Araçları',
    logo: logoGit,
    description: 'Yerel Git depolarında status, diff, log, commit ve dal yönetimi.',
    type: 'stdio',
    defaultCommand: 'uvx mcp-server-git',
    toolsCount: 0,
    featured: true,
    authGuide: 'Yerel Git deponuzun tam dosya yolu yeterlidir. Herhangi bir harici API anahtarı gerektirmez.',
    tools: [],
    configFields: [
      { key: 'GIT_REPO_PATH', label: 'Yerel Git Deposu Klasör Yolu', placeholder: 'C:\\Projects\\MyProject', type: 'text', hint: '.git klasörü içeren kök dizin.' }
    ]
  },
  {
    id: 'bitbucket',
    name: 'Bitbucket MCP',
    category: 'dev',
    categoryLabel: 'Geliştirici Araçları',
    logo: logoBitbucket,
    description: 'Bitbucket Cloud repoları, Pull Request incelemeleri ve commit geçmişi.',
    type: 'stdio',
    defaultCommand: 'npx -y bitbucket-mcp',
    toolsCount: 0,
    authGuide: 'Bitbucket Ayarları > Personal settings > App passwords üzerinden repositories izinli şifre üretin.',
    tools: [],
    configFields: [
      { key: 'BITBUCKET_USERNAME', label: 'Bitbucket Kullanıcı Adı', placeholder: 'mehmetkraga', type: 'text' },
      { key: 'BITBUCKET_APP_PASSWORD', label: 'Bitbucket App Password', placeholder: 'sec-app-pass-...', type: 'password' }
    ]
  },
  {
    id: 'filesystem',
    name: 'Filesystem MCP',
    category: 'dev',
    categoryLabel: 'Geliştirici Araçları',
    logo: logoFilesystem,
    description: 'Belirlenen güvenli dizinlerde dosya okuma, yazma, arama ve klasör listeleme.',
    type: 'stdio',
    defaultCommand: 'npx -y @modelcontextprotocol/server-filesystem',
    toolsCount: 0,
    featured: true,
    authGuide: 'Yapay zekanın okuyup yazabileceği güvenli klasör yollarını virgülle ayırarak girin.',
    tools: [],
    configFields: [
      { key: 'ALLOWED_DIRECTORIES', label: 'İzinli Dizinler (Virgülle ayrılmış)', placeholder: 'C:\\Projects, F:\\KragaVault', type: 'text', hint: 'Erişime açık klasör yolları.' }
    ]
  },
  {
    id: 'sqlite',
    name: 'SQLite MCP',
    category: 'db',
    categoryLabel: 'Veritabanı',
    logo: logoSQLite,
    description: 'Yerel SQLite veri dosyalarında tablo oluşturma, sorgulama ve veri inceleme.',
    type: 'stdio',
    defaultCommand: 'uvx mcp-server-sqlite',
    toolsCount: 0,
    featured: true,
    authGuide: 'İncelemek istediğiniz .db veya .sqlite dosyasının tam dosya yolunu belirtin.',
    tools: [],
    configFields: [
      { key: 'SQLITE_DB_PATH', label: 'SQLite Veritabanı Dosya Yolu (.db)', placeholder: 'C:\\data\\database.sqlite', type: 'text' }
    ]
  },
  {
    id: 'mysql',
    name: 'MySQL MCP',
    category: 'db',
    categoryLabel: 'Veritabanı',
    logo: logoMySQL,
    description: 'MySQL & MariaDB sunucularına bağlanarak SQL sorgulama, tablo şeması çıkarma.',
    type: 'stdio',
    defaultCommand: 'npx -y @benborla29/mcp-server-mysql',
    toolsCount: 0,
    authGuide: 'MySQL veritabanı sunucunuzun bağlantı parametrelerini doldurun.',
    tools: [],
    configFields: [
      { key: 'MYSQL_HOST', label: 'MySQL Host', placeholder: 'localhost', type: 'text' },
      { key: 'MYSQL_USER', label: 'Kullanıcı Adı', placeholder: 'root', type: 'text' },
      { key: 'MYSQL_PASSWORD', label: 'Şifre', placeholder: '••••••••', type: 'password' },
      { key: 'MYSQL_DATABASE', label: 'Veritabanı Adı', placeholder: 'uygulama_db', type: 'text' },
      { key: 'MYSQL_PORT', label: 'Port (Opsiyonel)', placeholder: '3306', type: 'text', optional: true }
    ]
  },
  {
    id: 'mongodb',
    name: 'MongoDB MCP',
    category: 'db',
    categoryLabel: 'Veritabanı',
    logo: logoMongoDB,
    description: 'MongoDB NoSQL veritabanında koleksiyon arama, JSON doküman sorgulama ve aggregation.',
    type: 'stdio',
    defaultCommand: 'npx -y mcp-mongo-server',
    toolsCount: 0,
    authGuide: 'MongoDB Atlas veya yerel instance bağlantı dizesini girin.',
    tools: [],
    configFields: [
      { key: 'MONGODB_URI', label: 'MongoDB Bağlantı Adresi (URI)', placeholder: 'mongodb+srv://user:pass@cluster0.mongodb.net/dbname', type: 'text' }
    ]
  },
  {
    id: 'snowflake',
    name: 'Snowflake Analytics MCP',
    category: 'db',
    categoryLabel: 'Veritabanı',
    logo: logoSnowflake,
    description: 'Snowflake bulut veri ambarında analitik SQL koşturma ve büyük veri sorgulama.',
    type: 'stdio',
    defaultCommand: 'npx -y mcp-snowflake',
    toolsCount: 0,
    authGuide: 'Snowflake hesap tanımlayıcısı ve yetkili kullanıcı giriş bilgilerinizi sağlayın.',
    tools: [],
    configFields: [
      { key: 'SNOWFLAKE_ACCOUNT', label: 'Snowflake Hesap Kodu', placeholder: 'xy12345.eu-west-1', type: 'text' },
      { key: 'SNOWFLAKE_USER', label: 'Kullanıcı Adı', placeholder: 'DB_USER', type: 'text' },
      { key: 'SNOWFLAKE_PASSWORD', label: 'Şifre', placeholder: '••••••••', type: 'password' },
      { key: 'SNOWFLAKE_DATABASE', label: 'Veritabanı', placeholder: 'ANALYTICS_DB', type: 'text' },
      { key: 'SNOWFLAKE_WAREHOUSE', label: 'Warehouse (Opsiyonel)', placeholder: 'COMPUTE_WH', type: 'text', optional: true }
    ]
  },
  {
    id: 'qdrant',
    name: 'Qdrant Vector Engine MCP',
    category: 'db',
    categoryLabel: 'Veritabanı',
    logo: logoQdrant,
    description: 'Yüksek performanslı vektör arama motoru, payload filtreleme ve RAG entegrasyonu.',
    type: 'stdio',
    defaultCommand: 'npx -y mcp-server-qdrant',
    toolsCount: 0,
    authGuide: 'Qdrant bulut kümesi veya yerel localhost:6333 URL adresini girin.',
    tools: [],
    configFields: [
      { key: 'QDRANT_URL', label: 'Qdrant URL Adresi', placeholder: 'http://localhost:6333', type: 'text' },
      { key: 'QDRANT_API_KEY', label: 'API Key (Opsiyonel)', placeholder: 'qdrant-key-...', type: 'password', optional: true }
    ]
  },
  {
    id: 'docker',
    name: 'Docker MCP',
    category: 'cloud',
    categoryLabel: 'DevOps & Bulut',
    logo: logoDocker,
    description: 'Konteyner yönetimi, image build etme, canlı container logları ve docker-compose kontrolü.',
    type: 'stdio',
    defaultCommand: 'docker run -i --rm -v /var/run/docker.sock:/var/run/docker.sock mcp/docker',
    toolsCount: 0,
    featured: true,
    authGuide: 'Docker Desktop uygulamasının sisteminizde çalışır durumda olduğundan emin olun.',
    tools: [],
    configFields: [
      { key: 'DOCKER_HOST', label: 'Docker Host Socket (Opsiyonel)', placeholder: 'npipe:////./pipe/docker_engine', type: 'text', optional: true, hint: 'Windows için named pipe veya Unix socket yolu.' }
    ]
  },
  {
    id: 'kubernetes',
    name: 'Kubernetes (K8s) MCP',
    category: 'cloud',
    categoryLabel: 'DevOps & Bulut',
    logo: logoKubernetes,
    description: 'K8s pod denetimi, deployment yönetimi, canlı pod logları ve resource manifestleri.',
    type: 'stdio',
    defaultCommand: 'npx -y mcp-server-kubernetes',
    toolsCount: 0,
    featured: true,
    authGuide: 'Yerel ~/.kube/config dosyanız üzerinden kubectl yetkisiyle kümelere bağlanır.',
    tools: [],
    configFields: [
      { key: 'KUBECONFIG_PATH', label: 'Kubeconfig Dosya Yolu (Opsiyonel)', placeholder: '~/.kube/config', type: 'text', optional: true },
      { key: 'K8S_CONTEXT', label: 'K8s Cluster Context (Opsiyonel)', placeholder: 'minikube veya gke_cluster', type: 'text', optional: true }
    ]
  },
  {
    id: 'gcp',
    name: 'Google Cloud (GCP) MCP',
    category: 'cloud',
    categoryLabel: 'DevOps & Bulut',
    logo: logoGCP,
    description: 'Google Cloud Platform Cloud Storage, Compute Engine ve Cloud Run denetimi.',
    type: 'stdio',
    defaultCommand: 'npx -y mcp-server-gcp',
    toolsCount: 0,
    featured: true,
    authGuide: 'Google Cloud Console > IAM & Admin > Service Accounts sayfasından JSON anahtarını indirin ve dosya yolunu belirtin.',
    tools: [],
    configFields: [
      { key: 'GCP_PROJECT_ID', label: 'Google Cloud Proje ID', placeholder: 'my-gcp-project-12345', type: 'text' },
      { key: 'GOOGLE_APPLICATION_CREDENTIALS', label: 'Service Account JSON Dosya Yolu', placeholder: 'C:\\keys\\gcp-service-account.json', type: 'text', hint: 'İndirdiğiniz .json kimlik dosyasının tam yolu.' }
    ]
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare MCP',
    category: 'cloud',
    categoryLabel: 'DevOps & Bulut',
    logo: logoCloudflare,
    description: 'Cloudflare Workers dağıtımı, KV önbellek, D1 veritabanı ve DNS kayıtları yönetimi.',
    type: 'stdio',
    defaultCommand: 'npx -y @cloudflare/mcp-server-cloudflare',
    toolsCount: 0,
    featured: true,
    authGuide: 'dash.cloudflare.com > My Profile > API Tokens bölümünden Workers ve KV izinli API Token alın.',
    tools: [],
    configFields: [
      { key: 'CLOUDFLARE_ACCOUNT_ID', label: 'Cloudflare Account ID', placeholder: 'a1b2c3d4e5...', type: 'text' },
      { key: 'CLOUDFLARE_API_TOKEN', label: 'Cloudflare API Token', placeholder: 'cf_tok_...', type: 'password' }
    ]
  },
  {
    id: 'azure',
    name: 'Microsoft Azure MCP',
    category: 'cloud',
    categoryLabel: 'DevOps & Bulut',
    logo: logoAzure,
    description: 'Azure sanal makineler, Resource Groups, Blob Storage ve App Services yönetimi.',
    type: 'stdio',
    defaultCommand: 'npx -y azure-mcp-server',
    toolsCount: 0,
    authGuide: 'Azure Portal > App Registrations sayfasından Service Principal oluşturup Client Secret üretin.',
    tools: [],
    configFields: [
      { key: 'AZURE_SUBSCRIPTION_ID', label: 'Abonelik ID (Subscription ID)', placeholder: '00000000-0000-0000-0000-000000000000', type: 'text' },
      { key: 'AZURE_TENANT_ID', label: 'Kiracı ID (Tenant ID)', placeholder: '00000000-0000-0000-0000-000000000000', type: 'text' },
      { key: 'AZURE_CLIENT_ID', label: 'İstemci ID (Client ID)', placeholder: '00000000-0000-0000-0000-000000000000', type: 'text' },
      { key: 'AZURE_CLIENT_SECRET', label: 'İstemci Parolası (Client Secret)', placeholder: '••••••••', type: 'password' }
    ]
  },
  {
    id: 'vercel',
    name: 'Vercel Deployment MCP',
    category: 'cloud',
    categoryLabel: 'DevOps & Bulut',
    logo: logoVercel,
    description: 'Frontend projelerini Vercel üzerinde canlıya alma, build logları ve domain kontrolü.',
    type: 'stdio',
    defaultCommand: 'npx -y vercel-mcp',
    toolsCount: 0,
    featured: true,
    authGuide: 'vercel.com/account/tokens adresinden Vercel Personal Access Token oluşturun.',
    tools: [],
    configFields: [
      { key: 'VERCEL_API_TOKEN', label: 'Vercel API Token', placeholder: 'vca_...', type: 'password' },
      { key: 'VERCEL_TEAM_ID', label: 'Team ID (Opsiyonel)', placeholder: 'team_...', type: 'text', optional: true }
    ]
  },
  {
    id: 'datadog',
    name: 'Datadog APM MCP',
    category: 'cloud',
    categoryLabel: 'DevOps & Bulut',
    logo: logoDatadog,
    description: 'Sistem metrikleri, sunucu yükü, APM izleme ve alarm kayıtlarını denetleme.',
    type: 'stdio',
    defaultCommand: 'npx -y datadog-mcp',
    toolsCount: 0,
    authGuide: 'Datadog > Organization Settings > API Keys & Application Keys sayfalarından anahtarlarınızı alın.',
    tools: [],
    configFields: [
      { key: 'DD_API_KEY', label: 'Datadog API Key', placeholder: '••••••••', type: 'password' },
      { key: 'DD_APP_KEY', label: 'Datadog Application Key', placeholder: '••••••••', type: 'password' },
      { key: 'DD_SITE', label: 'Datadog Site (Opsiyonel)', placeholder: 'datadoghq.com', type: 'text', optional: true }
    ]
  },
  {
    id: 'brave-search',
    name: 'Brave Web Search MCP',
    category: 'search',
    categoryLabel: 'Web & Arama',
    logo: logoBrave,
    description: 'Gizlilik odaklı gerçek zamanlı web, haber ve dokümantasyon arama motoru.',
    type: 'stdio',
    defaultCommand: 'npx -y @brave/brave-search-mcp-server',
    toolsCount: 0,
    featured: true,
    authGuide: 'brave.com/search/api adresinden ücretsiz Brave Search API Key oluşturun.',
    tools: [],
    configFields: [
      { key: 'BRAVE_API_KEY', label: 'Brave Search API Key', placeholder: 'BSA...', type: 'password' }
    ]
  },
  {
    id: 'perplexity',
    name: 'Perplexity AI Search MCP',
    category: 'search',
    categoryLabel: 'Web & Arama',
    logo: logoPerplexity,
    description: 'Perplexity Sonar modelleriyle gerçek zamanlı internet araştırması ve kaynaklı cevaplar.',
    type: 'stdio',
    defaultCommand: 'npx -y mcp-server-perplexity',
    toolsCount: 0,
    featured: true,
    authGuide: 'perplexity.ai/settings/api adresinden API Key alın.',
    tools: [],
    configFields: [
      { key: 'PERPLEXITY_API_KEY', label: 'Perplexity API Key', placeholder: 'pplx-...', type: 'password' }
    ]
  },
  {
    id: 'playwright',
    name: 'Playwright Browser MCP',
    category: 'search',
    categoryLabel: 'Web & Arama',
    logo: logoPlaywright,
    description: 'Çoklu tarayıcı (Chromium/Firefox/WebKit) otomasyonu, form doldurma ve E2E test.',
    type: 'stdio',
    defaultCommand: 'npx -y @executeautomation/playwright-mcp-server',
    toolsCount: 0,
    featured: true,
    authGuide: 'Playwright tarayıcı motorunu yerel olarak koşturur. Anahtar gerektirmez.',
    tools: [],
    configFields: [
      { key: 'PLAYWRIGHT_BROWSER', label: 'Tarayıcı Tipi (Opsiyonel)', placeholder: 'chromium', type: 'text', optional: true }
    ]
  },
  {
    id: 'firecrawl',
    name: 'Firecrawl Scraper MCP',
    category: 'search',
    categoryLabel: 'Web & Arama',
    logo: logoFirecrawl,
    description: 'Web sitelerini temiz Markdown formatında tarama, sitemap çıkarma ve derin scraping.',
    type: 'stdio',
    defaultCommand: 'npx -y firecrawl-mcp',
    toolsCount: 0,
    featured: true,
    authGuide: 'firecrawl.dev adresinden API Key alın.',
    tools: [],
    configFields: [
      { key: 'FIRECRAWL_API_KEY', label: 'Firecrawl API Key', placeholder: 'fc-...', type: 'password' }
    ]
  },
  {
    id: 'fetch',
    name: 'Web Content Fetcher MCP',
    category: 'search',
    categoryLabel: 'Web & Arama',
    logo: logoFetch,
    description: 'Herhangi bir URL adresinden hızlıca ham HTML veya okunabilir Markdown metni çekme.',
    type: 'stdio',
    defaultCommand: 'uvx mcp-server-fetch',
    toolsCount: 0,
    featured: true,
    authGuide: 'Sıfır konfigürasyon. Herhangi bir genel URL adresini anında okur.',
    tools: [],
    configFields: []
  },
  {
    id: 'notion',
    name: 'Notion Workspace MCP',
    category: 'comms',
    categoryLabel: 'İletişim & Görev',
    logo: logoNotion,
    description: 'Notion sayfaları, veritabanları, blok düzenleme ve ekip notları senkronizasyonu.',
    type: 'stdio',
    defaultCommand: 'npx -y @notionhq/notion-mcp-server',
    toolsCount: 0,
    featured: true,
    authGuide: 'notion.so/my-integrations adresinden Internal Integration oluşturup token alın ve ilgili sayfaları bu entegrasyonla paylaşın.',
    tools: [],
    configFields: [
      { key: 'NOTION_API_KEY', label: 'Notion Integration Secret', placeholder: 'ntn_...', type: 'password' }
    ]
  },
  {
    id: 'obsidian',
    name: 'Obsidian Vault MCP',
    category: 'comms',
    categoryLabel: 'İletişim & Görev',
    logo: logoObsidian,
    description: 'Yerel Obsidian Markdown vault notları, backlinkler ve etiket sorgulama.',
    type: 'stdio',
    defaultCommand: 'npx -y mcp-obsidian',
    toolsCount: 0,
    featured: true,
    authGuide: 'Obsidian Local REST API eklentisi portunu veya doğrudan Vault klasör yolunuzu belirtin.',
    tools: [],
    configFields: [
      { key: 'OBSIDIAN_VAULT_PATH', label: 'Obsidian Vault Klasör Yolu', placeholder: 'F:\\KragaVault', type: 'text' },
      { key: 'OBSIDIAN_API_KEY', label: 'Obsidian REST API Key (Opsiyonel)', placeholder: '••••••••', type: 'password', optional: true }
    ]
  },
  {
    id: 'todoist',
    name: 'Todoist MCP',
    category: 'comms',
    categoryLabel: 'İletişim & Görev',
    logo: logoTodoist,
    description: 'Todoist görev listeleri, hatırlatıcılar, projeler ve GTD görev yönetimi.',
    type: 'stdio',
    defaultCommand: 'npx -y mcp-todoist',
    toolsCount: 0,
    authGuide: 'app.todoist.com > Ayarlar > Entegrasyonlar > Geliştirici altından API Tokenınızı kopyalayın.',
    tools: [],
    configFields: [
      { key: 'TODOIST_API_TOKEN', label: 'Todoist API Token', placeholder: '••••••••', type: 'password' }
    ]
  },
  {
    id: 'telegram',
    name: 'Telegram Bot MCP',
    category: 'comms',
    categoryLabel: 'İletişim & Görev',
    logo: logoTelegram,
    description: 'Telegram botu üzerinden kanallara bildirim gönderme, mesaj okuma ve anket açma.',
    type: 'stdio',
    defaultCommand: 'npx -y telegram-mcp',
    toolsCount: 0,
    authGuide: 'Telegramda @BotFather ile yeni bir bot oluşturun ve verilen HTTP API tokenını girin.',
    tools: [],
    configFields: [
      { key: 'TELEGRAM_BOT_TOKEN', label: 'Telegram Bot Token', placeholder: '123456789:ABCdefGhIJKlmNoPQ...', type: 'password' }
    ]
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Business MCP',
    category: 'comms',
    categoryLabel: 'İletişim & Görev',
    logo: logoWhatsApp,
    description: 'Meta WhatsApp Business API ile şablon mesajları gönderme ve müşteri iletişimi.',
    type: 'stdio',
    defaultCommand: 'npx -y whatsapp-mcp-server',
    toolsCount: 0,
    authGuide: 'Meta for Developers > WhatsApp Business API üzerinden erişim belirteci ve telefon numara ID değerlerini alın.',
    tools: [],
    configFields: [
      { key: 'WHATSAPP_API_TOKEN', label: 'WhatsApp Access Token', placeholder: 'EAA...', type: 'password' },
      { key: 'WHATSAPP_PHONE_NUMBER_ID', label: 'Phone Number ID', placeholder: '10987654321', type: 'text' }
    ]
  },
  {
    id: 'airtable',
    name: 'Airtable MCP',
    category: 'comms',
    categoryLabel: 'İletişim & Görev',
    logo: logoAirtable,
    description: 'Airtable ilişkisel elektronik tablo kayıtları ekleme, sorgulama ve şema inceleme.',
    type: 'stdio',
    defaultCommand: 'npx -y mcp-airtable',
    toolsCount: 0,
    authGuide: 'airtable.com/create/tokens adresinden Personal Access Token oluşturun.',
    tools: [],
    configFields: [
      { key: 'AIRTABLE_API_KEY', label: 'Airtable Personal Access Token', placeholder: 'pat...', type: 'password' },
      { key: 'AIRTABLE_BASE_ID', label: 'Airtable Base ID (Opsiyonel)', placeholder: 'app...', type: 'text', optional: true }
    ]
  },
  {
    id: 'stripe',
    name: 'Stripe Payments MCP',
    category: 'comms',
    categoryLabel: 'İletişim & Görev',
    logo: logoStripe,
    description: 'Stripe ödemeleri, abonelik takibi, faturalandırma ve ödeme linki üretme.',
    type: 'stdio',
    defaultCommand: 'npx -y @stripe/mcp',
    toolsCount: 0,
    featured: true,
    authGuide: 'dashboard.stripe.com/apikeys adresinden Restricted veya Secret API anahtarınızı temin edin.',
    tools: [],
    configFields: [
      { key: 'STRIPE_SECRET_KEY', label: 'Stripe Secret Key', placeholder: 'sk_live_... veya sk_test_...', type: 'password' }
    ]
  },
  {
    id: 'twilio',
    name: 'Twilio SMS & Voice MCP',
    category: 'comms',
    categoryLabel: 'İletişim & Görev',
    logo: logoTwilio,
    description: 'SMS gönderimi, WhatsApp entegrasyonu ve telefon araması tetikleme.',
    type: 'stdio',
    defaultCommand: 'npx -y twilio-mcp-server',
    toolsCount: 0,
    authGuide: 'console.twilio.com ana sayfasından Account SID ve Auth Token değerlerinizi kopyalayın.',
    tools: [],
    configFields: [
      { key: 'TWILIO_ACCOUNT_SID', label: 'Twilio Account SID', placeholder: 'AC...', type: 'text' },
      { key: 'TWILIO_AUTH_TOKEN', label: 'Twilio Auth Token', placeholder: '••••••••', type: 'password' },
      { key: 'TWILIO_FROM_PHONE', label: 'Gönderici Telefon No (Opsiyonel)', placeholder: '+1234567890', type: 'text', optional: true }
    ]
  },
  {
    id: 'sendgrid',
    name: 'SendGrid Email MCP',
    category: 'comms',
    categoryLabel: 'İletişim & Görev',
    logo: logoSendGrid,
    description: 'İşlemsel e-posta (Transactional Email) gönderimi, şablon kullanımı ve teslim raporları.',
    type: 'stdio',
    defaultCommand: 'npx -y sendgrid-mcp',
    toolsCount: 0,
    authGuide: 'app.sendgrid.com > Settings > API Keys üzerinden Mail Send yetkili API Key oluşturun.',
    tools: [],
    configFields: [
      { key: 'SENDGRID_API_KEY', label: 'SendGrid API Key', placeholder: 'SG....', type: 'password' },
      { key: 'SENDGRID_FROM_EMAIL', label: 'Gönderici E-Posta Adresi', placeholder: 'noreply@sirketiniz.com', type: 'text' }
    ]
  },
  {
    id: 'asana',
    name: 'Asana Project MCP',
    category: 'comms',
    categoryLabel: 'İletişim & Görev',
    logo: logoAsana,
    description: 'Asana proje takibi, görev atama, teslim tarihi güncelleme ve iş yükü denetimi.',
    type: 'stdio',
    defaultCommand: 'npx -y asana-mcp',
    toolsCount: 0,
    authGuide: 'app.asana.com/-/developer-console üzerinden Personal Access Token oluşturun.',
    tools: [],
    configFields: [
      { key: 'ASANA_ACCESS_TOKEN', label: 'Asana Personal Access Token', placeholder: '1/123456789:...', type: 'password' }
    ]
  },
  {
    id: 'confluence',
    name: 'Atlassian Confluence MCP',
    category: 'comms',
    categoryLabel: 'İletişim & Görev',
    logo: logoConfluence,
    description: 'Şirket wiki dokümantasyonu, teknik sayfalar ve Confluence alanları yönetimi.',
    type: 'stdio',
    defaultCommand: 'npx -y mcp-server-confluence',
    toolsCount: 0,
    authGuide: 'Atlassian hesabınızdan API Token oluşturun ve şirket wiki dokümantasyonunu bağlayın.',
    tools: [],
    configFields: [
      { key: 'CONFLUENCE_URL', label: 'Confluence URL Adresi', placeholder: 'https://sirketiniz.atlassian.net/wiki', type: 'text' },
      { key: 'CONFLUENCE_EMAIL', label: 'Atlassian E-Posta', placeholder: 'adiniz@sirket.com', type: 'text' },
      { key: 'CONFLUENCE_API_TOKEN', label: 'Atlassian API Token', placeholder: '••••••••', type: 'password' }
    ]
  },
  {
    id: 'blender',
    name: 'Blender 3D MCP',
    category: 'gamedev',
    categoryLabel: 'Oyun & 3D',
    logo: logoBlender,
    description: 'Blender 3D ile entegre mesh oluşturma, materyal atama, Python script yürütme ve sahne render alma.',
    type: 'stdio',
    defaultCommand: 'uvx blender-mcp',
    toolsCount: 0,
    featured: true,
    authGuide: 'Blender 3D program dosyasının yolunu belirtin. Editör içinde çalışan eklentiye bağlanır.',
    tools: [],
    configFields: [
      { key: 'BLENDER_PATH', label: 'Blender Program Yolu', placeholder: 'C:\\Program Files\\Blender Foundation\\Blender 4.2\\blender.exe', type: 'text' },
      { key: 'BLENDER_PORT', label: 'Blender Eklenti Portu (Opsiyonel)', placeholder: '9876', type: 'text', optional: true }
    ]
  },
  {
    id: 'godot',
    name: 'Godot Engine 4 MCP',
    category: 'gamedev',
    categoryLabel: 'Oyun & 3D',
    logo: logoGodot,
    description: 'Godot 4 sahne ağacı (SceneTree), GDScript kodları, Node ekleme/çıkarma ve test sahnesi koşturma entegrasyonu.',
    type: 'stdio',
    defaultCommand: 'uvx godot-mcp',
    toolsCount: 0,
    featured: true,
    authGuide: 'Godot 4 proje dosyasını (project.godot) belirtin. GDScript denetimi ve sahne çalıştırma sağlar.',
    tools: [],
    configFields: [
      { key: 'GODOT_PROJECT_FILE', label: 'Godot Proje Dosyası (project.godot)', placeholder: 'C:\\Projects\\GodotGame\\project.godot', type: 'text' },
      { key: 'GODOT_BIN_PATH', label: 'Godot 4 Executable Dosya Yolu (Opsiyonel)', placeholder: 'C:\\Tools\\Godot_v4.2.exe', type: 'text', optional: true }
    ]
  },
  {
    id: 'sequential-thinking',
    name: 'Sequential Thinking MCP',
    category: 'ai',
    categoryLabel: 'Yapay Zeka & Bellek',
    logo: logoSequentialThinking,
    description: 'Karmaşık mimari problemlerde adımlı derin akıl yürütme ve hipotez doğrulama motoru.',
    type: 'stdio',
    defaultCommand: 'npx -y @modelcontextprotocol/server-sequential-thinking',
    toolsCount: 0,
    featured: true,
    authGuide: 'Sıfır konfigürasyon. Karmaşık matematik ve mimari problemlerde adım adım düşünme sağlar.',
    tools: [],
    configFields: []
  },
  {
    id: 'memory',
    name: 'Memory & Knowledge Graph MCP',
    category: 'ai',
    categoryLabel: 'Yapay Zeka & Bellek',
    logo: logoMemory,
    description: 'Kalıcı bilgi grafiği (Knowledge Graph) tabanlı uzun vadeli hafıza ve varlık ilişkileri.',
    type: 'stdio',
    defaultCommand: 'npx -y @modelcontextprotocol/server-memory',
    toolsCount: 0,
    featured: true,
    authGuide: 'Konuşmalar arasındaki kalıcı hafızayı yerel JSON grafiğinde depolar.',
    tools: [],
    configFields: [
      { key: 'MEMORY_FILE_PATH', label: 'Hafıza Dosya Yolu (Opsiyonel)', placeholder: '~/.kraga/memory.json', type: 'text', optional: true }
    ]
  },
  {
    id: 'meshy-3d',
    name: 'Meshy 3D AI MCP',
    category: 'ai',
    categoryLabel: 'Yapay Zeka & Bellek',
    logo: logoMeshy,
    description: 'Metinden ve 2D görsellerden profesyonel 3D model (glTF, OBJ, FBX) üretimi.',
    type: 'stdio',
    defaultCommand: 'npx -y meshy-mcp',
    toolsCount: 0,
    featured: true,
    authGuide: 'app.meshy.ai > Settings > API Key üzerinden anahtarınızı temin edin.',
    tools: [],
    configFields: [
      { key: 'MESHY_API_KEY', label: 'Meshy AI API Key', placeholder: 'msy_...', type: 'password' }
    ]
  },
  {
    id: 'replicate',
    name: 'Replicate AI Models MCP',
    category: 'ai',
    categoryLabel: 'Yapay Zeka & Bellek',
    logo: logoReplicate,
    description: 'Flux, SDXL, Stable Diffusion, Llama ve binlerce açık kaynak yapay zeka modelini çalıştırma.',
    type: 'stdio',
    defaultCommand: 'npx -y replicate-mcp',
    toolsCount: 0,
    featured: true,
    authGuide: 'replicate.com/account/api-tokens sayfasından API Tokenınızı kopyalayın.',
    tools: [],
    configFields: [
      { key: 'REPLICATE_API_TOKEN', label: 'Replicate API Token', placeholder: 'r8_...', type: 'password' }
    ]
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs Voice AI MCP',
    category: 'ai',
    categoryLabel: 'Yapay Zeka & Bellek',
    logo: logoElevenLabs,
    description: 'Ultra gerçekçi seslendirme (TTS), ses klonlama, efekt üretimi ve dublaj.',
    type: 'stdio',
    defaultCommand: 'npx -y elevenlabs-mcp',
    toolsCount: 0,
    featured: true,
    authGuide: 'elevenlabs.io > Profile Settings > API Key üzerinden anahtarınızı alın.',
    tools: [],
    configFields: [
      { key: 'ELEVENLABS_API_KEY', label: 'ElevenLabs API Key', placeholder: '••••••••', type: 'password' }
    ]
  },
  {
    id: 'huggingface',
    name: 'Hugging Face Hub MCP',
    category: 'ai',
    categoryLabel: 'Yapay Zeka & Bellek',
    logo: logoHuggingFace,
    description: 'Hugging Face model havuzunda arama, Inference API çalıştırma ve dataset indirme.',
    type: 'stdio',
    defaultCommand: 'npx -y huggingface-mcp',
    toolsCount: 0,
    featured: true,
    authGuide: 'huggingface.co/settings/tokens adresinden User Access Token (read yetkili) oluşturun.',
    tools: [],
    configFields: [
      { key: 'HF_TOKEN', label: 'Hugging Face User Access Token', placeholder: 'hf_...', type: 'password' }
    ]
  },
  {
    id: 'time',
    name: 'World Time MCP',
    category: 'ai',
    categoryLabel: 'Yapay Zeka & Bellek',
    logo: logoTime,
    description: 'Dünya saat dilimleri, zaman dönüşümleri ve hassas UNIX timestamp hesaplama.',
    type: 'stdio',
    defaultCommand: 'uvx mcp-server-time',
    toolsCount: 0,
    authGuide: 'Sıfır konfigürasyon. Dünya saat dilimlerini ve yerel saatleri hesaplar.',
    tools: [],
    configFields: [
      { key: 'LOCAL_TIMEZONE', label: 'Varsayılan Saat Dilimi (Opsiyonel)', placeholder: 'Europe/Istanbul', type: 'text', optional: true }
    ]
  },
  {
    id: 'context7',
    name: 'Context7',
    category: 'dev',
    categoryLabel: 'Geliştirici Araçları',
    logo: (size = 24) => `<div style="width:${size}px;height:${size}px;display:grid;place-items:center;border-radius:6px;background:var(--bg-hover,#262626);color:var(--text-primary,#fff);font-weight:700;font-size:${Math.round(size * 0.55)}px">C</div>`,
    description: 'Kütüphane ve framework dokümantasyonunu güncel sürümüyle getirir. Anahtar gerekmez.',
    type: 'http',
    defaultUrl: 'https://mcp.context7.com/mcp',
    toolsCount: 0,
    featured: true,
    tools: [],
    configFields: []
  },
  {
    id: 'deepwiki',
    name: 'DeepWiki',
    category: 'dev',
    categoryLabel: 'Geliştirici Araçları',
    logo: (size = 24) => `<div style="width:${size}px;height:${size}px;display:grid;place-items:center;border-radius:6px;background:var(--bg-hover,#262626);color:var(--text-primary,#fff);font-weight:700;font-size:${Math.round(size * 0.55)}px">D</div>`,
    description: 'Herhangi bir GitHub deposunun yapısını okur ve repo hakkında soru yanıtlar. Anahtar gerekmez.',
    type: 'http',
    defaultUrl: 'https://mcp.deepwiki.com/mcp',
    toolsCount: 0,
    featured: false,
    tools: [],
    configFields: []
  },
  {
    id: 'cloudflare-docs',
    name: 'Cloudflare Docs',
    category: 'cloud',
    categoryLabel: 'Bulut & Altyapı',
    logo: logoCloudflare,
    description: 'Cloudflare dokümantasyonunda arama yapar. Anahtar gerekmez.',
    type: 'http',
    defaultUrl: 'https://docs.mcp.cloudflare.com/mcp',
    toolsCount: 0,
    featured: false,
    tools: [],
    configFields: []
  },
  {
    id: 'exa',
    name: 'Exa Search',
    category: 'search',
    categoryLabel: 'Arama & Web',
    logo: logoExa,
    description: 'Web araması ve sayfa içeriği okuma. Anahtar gerekmez.',
    type: 'http',
    defaultUrl: 'https://mcp.exa.ai/mcp',
    toolsCount: 0,
    featured: false,
    tools: [],
    configFields: []
  },
  {
    id: 'huggingface',
    name: 'Hugging Face',
    category: 'ai',
    categoryLabel: 'Yapay Zeka',
    logo: logoHuggingFace,
    description: 'Hub üzerinde model, veri seti ve Space araması. Token isteğe bağlıdır.',
    type: 'http',
    defaultUrl: 'https://huggingface.co/mcp',
    toolsCount: 0,
    featured: false,
    tools: [],
    configFields: [
      { key: 'TOKEN', label: 'Hugging Face Token', placeholder: 'hf_...', type: 'password', optional: true, hint: 'huggingface.co/settings/tokens adresinden alın; boş bırakırsanız yalnızca herkese açık veriler gelir.' }
    ]
  },
  {
    id: 'github',
    name: 'GitHub',
    category: 'dev',
    categoryLabel: 'Geliştirici Araçları',
    logo: logoGitHub,
    description: 'Depolar, issue ve pull request işlemleri (resmi GitHub MCP sunucusu).',
    type: 'http',
    defaultUrl: 'https://api.githubcopilot.com/mcp/',
    toolsCount: 0,
    featured: true,
    authGuide: 'github.com/settings/tokens adresinden bir Personal Access Token oluşturun; yalnızca gereken yetkileri verin.',
    tools: [],
    configFields: [
      { key: 'TOKEN', label: 'GitHub Personal Access Token', placeholder: 'ghp_... veya github_pat_...', type: 'password', hint: 'Token yalnızca bu bilgisayarda saklanır.' }
    ]
  },
  {
    id: 'linear',
    name: 'Linear',
    category: 'dev',
    categoryLabel: 'Geliştirici Araçları',
    logo: logoLinear,
    description: 'Issue, proje ve döngüleri arayın ve yönetin.',
    type: 'http',
    defaultUrl: 'https://mcp.linear.app/mcp',
    toolsCount: 0,
    featured: false,
    authGuide: 'Linear > Settings > API bölümünden kişisel API anahtarı oluşturun.',
    tools: [],
    configFields: [
      { key: 'TOKEN', label: 'Linear API Key', placeholder: 'lin_api_...', type: 'password', hint: 'Anahtar yalnızca bu bilgisayarda saklanır.' }
    ]
  }
];
