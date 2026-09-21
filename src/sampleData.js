// 内置样例数据（与 ObjectAnalyzer samples/test_data.json 同构）
export const SAMPLE_DATA = [
  {
    id: 1,
    name: '张三',
    age: 28,
    gender: 'Male',
    email: 'zhangsan@example.com',
    address: { city: '北京', district: '海淀区' },
    tags: ['C#', 'Developer'],
    skills: { primary: 'Python' },
    line: '{"body":"{\\"level\\":\\"info\\",\\"msg\\":\\"login\\"}","status":200}',
    createdAt: '2024-01-15T08:30:00',
  },
  {
    id: 2,
    name: '李四',
    age: 32,
    gender: 'Female',
    email: 'lisi@example.com',
    address: { city: '上海', district: '朝阳区' },
    tags: ['Java', 'Manager'],
    line: '{"body":"{\\"level\\":\\"warn\\",\\"msg\\":\\"timeout\\"}","status":500}',
    createdAt: '2024-03-22T14:05:00',
  },
  {
    id: 3,
    name: '王五',
    gender: 'Male',
    email: 'wangwu@example.com',
    address: { city: '北京' },
    tags: ['C#', 'Developer'],
    line: '{"body":"{\\"level\\":\\"info\\",\\"msg\\":\\"logout\\"}","status":200}',
    createdAt: '2024-06-10T09:00:00',
  },
];

/**
 * 全量样例：覆盖 unique / enum / min-max / pattern / nullRate /
 * transform.parse / base64 / jwt / pii / redact / valueParsers / 重复与脏数据
 */
export const FULL_SAMPLE_DATA = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    name: '张三',
    age: 28,
    gender: 'Male',
    email: 'zhangsan@example.com',
    phone: '13800138000',
    idCard: '110101199001011234',
    bankCard: '6222021234567890123',
    password: 'P@ssw0rd!Demo',
    secretToken: 'sk_live_demo_abc123xyz',
    ip: '192.168.1.10',
    website: 'https://www.example.com/path?q=1',
    birthDate: '1990-01-01',
    status: 'active',
    amount: 128.5,
    score: 92,
    address: { city: '北京', district: '海淀区', street: '中关村大街1号' },
    tags: ['C#', 'Developer'],
    skills: { primary: 'Python', level: 4 },
    line: '{"body":"{\\"level\\":\\"info\\",\\"msg\\":\\"login\\"}","status":200}',
    payload: '{"orderId":"O-1001","items":[{"sku":"A1","qty":2}],"paid":true}',
    noteB64: 'eyJub3RlIjoiaGVsbG8ifQ==',
    authJwt: 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1c2VyLTAwMSIsIm5hbWUiOiJ6aGFuZ3NhbiIsImV4cCI6MTkwMDAwMDAwMH0.',
    createdAt: '2024-01-15T08:30:00Z',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    name: '李四',
    age: 32,
    gender: 'Female',
    email: 'lisi@example.com',
    phone: '13912345678',
    idCard: '310101198805056789',
    bankCard: '6228480000000000001',
    password: 'AnotherSecret99',
    secretToken: 'sk_test_demo_def456',
    ip: '10.0.0.5',
    website: 'https://api.example.org/v1/users',
    birthDate: '1988-05-05',
    status: 'active',
    amount: 999.99,
    score: 88,
    address: { city: '上海', district: '浦东新区', street: '世纪大道100号' },
    tags: ['Java', 'Manager'],
    skills: { primary: 'Java', level: 5 },
    line: '{"body":"{\\"level\\":\\"warn\\",\\"msg\\":\\"timeout\\"}","status":500}',
    payload: '{"orderId":"O-1002","items":[{"sku":"B2","qty":1}],"paid":false}',
    noteB64: 'eyJub3RlIjoid29ybGQifQ==',
    authJwt: 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1c2VyLTAwMiIsIm5hbWUiOiJsaXNpIn0.',
    createdAt: '2024-03-22T14:05:00Z',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    name: '王五',
    age: 45,
    gender: 'Male',
    email: 'wangwu@example.com',
    phone: '13700001111',
    idCard: '44010119751212001X',
    bankCard: '6217000000000000000',
    password: 'TempPass#2024',
    secretToken: 'pat_demo_ghi789',
    ip: '172.16.0.8',
    website: 'http://intranet.local/health',
    birthDate: '1975-12-12',
    status: 'inactive',
    amount: 15,
    score: 61,
    address: { city: '广州' },
    tags: ['Go'],
    skills: { primary: 'Go', level: 3 },
    line: '{"body":"{\\"level\\":\\"info\\",\\"msg\\":\\"logout\\"}","status":200}',
    payload: '{"orderId":"O-1003","items":[],"paid":true}',
    noteB64: 'eyJub3RlIjoiYnllIn0=',
    authJwt: 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1c2VyLTAwMyJ9.',
    createdAt: '2024-06-10T09:00:00Z',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440004',
    name: '赵六',
    age: 19,
    gender: 'Unknown',
    email: 'zhaoliu@test.org',
    phone: '18612345678',
    idCard: '320102200501011111',
    bankCard: '6225880000000000',
    password: 'short',
    secretToken: 'x',
    ip: '8.8.8.8',
    website: 'https://cdn.example.net/a.png',
    birthDate: '2005-01-01',
    status: 'pending',
    amount: 50000,
    score: 40,
    address: { city: '南京', district: '鼓楼区' },
    tags: ['Intern', 'React'],
    skills: { primary: 'JavaScript', level: 2 },
    line: '{"body":"{\\"level\\":\\"error\\",\\"msg\\":\\"db\\"}","status":503}',
    payload: '{"orderId":"O-1004","items":[{"sku":"C3","qty":9}],"paid":true}',
    noteB64: 'e30=',
    authJwt: 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1c2VyLTAwNCIsInJvbGUiOiJpbnRlcm4ifQ.',
    createdAt: '2025-01-08T11:20:00Z',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440005',
    name: '钱七',
    gender: 'Female',
    email: 'invalid-email',
    phone: '12000000000',
    idCard: '123',
    bankCard: '1234',
    password: null,
    secretToken: null,
    ip: '999.1.1.1',
    website: 'not-a-url',
    birthDate: '2099-13-40',
    status: 'banned',
    amount: -3,
    score: 150,
    address: { city: '深圳' },
    tags: [],
    line: 'not-json',
    payload: '{}',
    createdAt: '2025-02-01T00:00:00Z',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    name: '张三-重复',
    age: 28,
    gender: 'Male',
    email: 'zhangsan@example.com',
    phone: '13800138000',
    status: 'active',
    amount: 128.5,
    address: { city: '北京', district: '海淀区' },
    line: '{"body":"{\\"level\\":\\"info\\",\\"msg\\":\\"dup\\"}","status":200}',
    payload: '{"orderId":"O-1001-dup","items":[],"paid":true}',
    createdAt: '2024-01-16T08:30:00Z',
  },
];

/** 与 FULL_SAMPLE_DATA 配套的全量规则（JSON 字符串，可直接 setRulesText） */
export const FULL_RULES_TEXT = `{
  "runtime": {
    "flatten": true
  },
  "fields": {
    "id": {
      "required": true,
      "unique": true,
      "primaryType": "String",
      "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"
    },
    "name": {
      "required": true,
      "primaryType": "String",
      "pattern": "\\\\S+",
      "pii": {
        "label": "姓名",
        "highSeverity": false,
        "mask": { "maskAll": false, "keepPrefix": 1, "keepSuffix": 0, "maskChar": "*" }
      }
    },
    "age": {
      "required": true,
      "primaryType": "Number",
      "minValue": 0,
      "maxValue": 120,
      "maxOutlierRatio": 0.15
    },
    "gender": {
      "required": true,
      "enumValues": ["Male", "Female", "Unknown"],
      "defaultValue": "Unknown"
    },
    "email": {
      "required": true,
      "primaryType": "String",
      "pattern": "^[^\\\\s@]+@[^\\\\s@]+\\\\.[^\\\\s@]+$",
      "pii": {
        "label": "邮箱",
        "highSeverity": true,
        "mask": { "maskAll": false, "keepPrefix": 2, "keepSuffix": 0, "maskChar": "*" }
      }
    },
    "phone": {
      "required": true,
      "pattern": "^1[3-9]\\\\d{9}$",
      "pii": {
        "label": "手机号",
        "highSeverity": true,
        "mask": { "maskAll": false, "keepPrefix": 3, "keepSuffix": 4, "maskChar": "*" }
      }
    },
    "idCard": {
      "pattern": "^[1-9]\\\\d{5}(18|19|20)\\\\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\\\\d|3[01])\\\\d{3}[\\\\dXx]$",
      "pii": {
        "label": "身份证",
        "highSeverity": true,
        "mask": { "maskAll": false, "keepPrefix": 4, "keepSuffix": 4, "maskChar": "*" }
      },
      "redact": true
    },
    "bankCard": {
      "pattern": "^\\\\d{13,19}$",
      "pii": {
        "label": "银行卡",
        "highSeverity": true,
        "mask": { "maskAll": false, "keepPrefix": 4, "keepSuffix": 4, "maskChar": "*" }
      },
      "redact": true
    },
    "password": {
      "nullRateMax": 0.3,
      "pii": {
        "label": "密码",
        "highSeverity": true,
        "mask": { "maskAll": true, "maskChar": "*" }
      },
      "redact": true
    },
    "secretToken": {
      "pii": {
        "label": "业务密钥",
        "highSeverity": true,
        "mask": { "maskAll": true }
      },
      "redact": true
    },
    "ip": {
      "pattern": "^((25[0-5]|2[0-4]\\\\d|[01]?\\\\d\\\\d?)\\\\.){3}(25[0-5]|2[0-4]\\\\d|[01]?\\\\d\\\\d?)$"
    },
    "website": {
      "pattern": "^https?:\\\\/\\\\/[^\\\\s]+$"
    },
    "birthDate": {
      "primaryType": "DateTime",
      "pattern": "^\\\\d{4}-\\\\d{2}-\\\\d{2}$"
    },
    "status": {
      "required": true,
      "enumValues": ["active", "inactive", "pending", "banned"]
    },
    "amount": {
      "primaryType": "Number",
      "minValue": 0,
      "maxValue": 100000,
      "maxOutlierRatio": 0.2
    },
    "score": {
      "primaryType": "Number",
      "minValue": 0,
      "maxValue": 100
    },
    "address.city": {
      "required": true,
      "primaryType": "String"
    },
    "address.district": {
      "nullRateMax": 0.25,
      "primaryType": "String"
    },
    "address.street": {
      "nullRateMax": 0.5
    },
    "skills.primary": {
      "primaryType": "String"
    },
    "skills.level": {
      "minValue": 1,
      "maxValue": 5
    },
    "line": {
      "transform": { "parse": "json" }
    },
    "line.body": {
      "transform": { "parse": "json" }
    },
    "line.status": {
      "primaryType": "Number",
      "minValue": 100,
      "maxValue": 599
    },
    "line.body.level": {
      "enumValues": ["info", "warn", "error", "debug"]
    },
    "noteB64": {
      "transform": {
        "type": "base64",
        "parse": "json"
      }
    },
    "authJwt": {
      "transform": {
        "type": "jwt",
        "claim": "sub"
      }
    },
    "payload": {
      "primaryType": "String"
    },
    "createdAt": {
      "primaryType": "DateTime"
    }
  },
  "valueParsers": [
    {
      "source": "payload",
      "parseType": "json",
      "flatten": true,
      "header": 1
    }
  ],
  "expectations": {
    "minRowCount": 3,
    "maxDuplicateRate": 0.2
  }
}
`;
