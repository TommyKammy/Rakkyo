import { requireSecret } from '../utils/secrets';
import crypto from 'crypto';

// Strict Whitelist Mapping Definitions to eliminate prompt injection
export const VEGETABLE_MAP = {
  RAKKYO: 'a cute, minimalist, child-friendly 2D rakkyo (scallion) illustration',
  ONION: 'a adorable, cartoon-style round yellow onion character',
  TURNIP: 'a cute, smiling white turnip character',
  TOMATO: 'a plump, happy red tomato mascot',
  CARROT: 'a slender, bright orange carrot mascot'
};

export const COLOR_MAP = {
  WHITE: 'with a clean white pearl skin tone',
  RED: 'with a bright friendly red body color',
  YELLOW: 'with a warm golden yellow tone',
  GREEN: 'with a vibrant leafy green tone',
  ORANGE: 'with a energetic sunny orange tone',
  PURPLE: 'with a rich whimsical purple color'
};

export const FEATURE_MAP = {
  BIG_EYES: 'featuring large, curious shiny anime-style eyes',
  SMILING_EYES: 'featuring happy squinting smiling eyes',
  CUTE_NOSE: 'featuring a tiny cute button nose',
  ROSY_CHEEKS: 'featuring soft blush pink rosy cheeks',
  WINK: 'featuring a playful winking expression with a cute mouth'
};

export const CLOTHING_MAP = {
  NONE: 'in a simple natural form without accessories',
  STARRY_GLASSES: 'wearing colorful star-shaped glasses',
  RED_BOWTIE: 'wearing a tiny red bowtie at the base',
  STRAW_HAT: 'wearing a small cute woven straw hat',
  HERO_CAPE: 'wearing a fluttering red hero cape',
  RAINBOW_SCARF: 'wearing a warm knitted rainbow scarf'
};

export const EXPRESSION_MAP = {
  HAPPY: 'looking joyful and happy',
  EXCITED: 'looking super excited with open arms',
  SMILING: 'wearing a sweet warm gentle smile',
  CURIOUS: 'looking curious and smart',
  GENKI: 'filled with high energy and pure cheerfulness'
};

export interface AvatarGenerationParams {
  baseVegetable: keyof typeof VEGETABLE_MAP;
  mainColor: keyof typeof COLOR_MAP;
  facialFeatures: keyof typeof FEATURE_MAP;
  clothing: keyof typeof CLOTHING_MAP;
  expression: keyof typeof EXPRESSION_MAP;
}

export interface IAvatarGeneratorService {
  generatePrompt(params: AvatarGenerationParams): string;
  generateCandidates(params: AvatarGenerationParams, count: number): Promise<Buffer[]>;
}

// 1x1 transparent PNG buffer to represent generated image in dev/test
const MOCK_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const MOCK_PNG_BUFFER = Buffer.from(MOCK_PNG_BASE64, 'base64');

export class AvatarGeneratorService implements IAvatarGeneratorService {
  private static instance: AvatarGeneratorService;

  public static getInstance(): AvatarGeneratorService {
    if (!AvatarGeneratorService.instance) {
      AvatarGeneratorService.instance = new AvatarGeneratorService();
    }
    return AvatarGeneratorService.instance;
  }

  public generatePrompt(params: AvatarGenerationParams): string {
    const veg = VEGETABLE_MAP[params.baseVegetable];
    const col = COLOR_MAP[params.mainColor];
    const feat = FEATURE_MAP[params.facialFeatures];
    const cloth = CLOTHING_MAP[params.clothing];
    const expr = EXPRESSION_MAP[params.expression];

    return `A high-quality 2D vector illustration of ${veg} ${col}. The mascot is ${feat}, ${cloth}, and ${expr}. Clean line art, solid white background, friendly character design for kids.`;
  }

  public async generateCandidates(params: AvatarGenerationParams, count: number): Promise<Buffer[]> {
    // Check if safety filter gets triggered (simulated for test values)
    // E.g., if a developer tries to bypass with a hypothetical unsafe parameter value
    if (params.baseVegetable as string === 'UNSAFE') {
      throw new Error('AI Safety Filter Triggered: Unsafe content detected.');
    }

    // Vertex AI / Gemini Imagen API simulation
    // In production, we would initialize the Google GenAI/Vertex SDK with high safety settings:
    // const imagen = ai.getImagenModel({
    //   safetySettings: [{ category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_LOW_AND_ABOVE' }]
    // });
    
    const candidates: Buffer[] = [];
    for (let i = 0; i < count; i++) {
      // Create a unique modified buffer for each candidate by appending seed bytes to make them distinct
      const seed = Buffer.from(`seed-${i}-${crypto.randomUUID()}`);
      candidates.push(Buffer.concat([MOCK_PNG_BUFFER, seed]));
    }
    return candidates;
  }
}

export const avatarGeneratorService = AvatarGeneratorService.getInstance();
