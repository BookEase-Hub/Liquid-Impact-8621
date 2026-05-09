import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

const ANALYSIS_PROMPT = `You are an expert nutritionist and health scientist. Analyze this drink image and return a detailed JSON health analysis.

Return ONLY a valid JSON object with this exact structure (no markdown, no explanation):
{
  "id": "scan_<random_8_char_string>",
  "detectedProduct": "<drink name>",
  "brand": "<brand name or null>",
  "category": "<water|juice|soda|energy|coffee|tea|alcohol|smoothie|sport|other>",
  "impactScore": <integer 0-100, 100 = perfectly healthy>,
  "hydrationLevel": <integer 0-100>,
  "glycemicImpact": "<low|moderate|high|very_high>",
  "status": "<optimal|stable|risky|damaging>",
  "aiInsight": "<2-3 sentence evidence-based health insight about this specific drink>",
  "viralStatement": "<one punchy shareable statement about this drink's body impact, max 15 words>",
  "shortTermImpact": {
    "energyResponse": "<what happens to energy in the next 1-2 hours>",
    "bloodSugarResponse": "<blood glucose effect within 30-60 minutes>",
    "bodyReaction": "<immediate physiological body reaction>",
    "hydrationImpact": "<effect on cellular hydration levels>"
  },
  "mediumTermImpact": {
    "energyStability": "<energy pattern with regular consumption over 1-4 weeks>",
    "physicalChanges": "<observable physical changes over several weeks>",
    "habitRisk": "<dependency or habit-formation risk level and mechanism>",
    "sleepQuality": "<effect on sleep architecture and quality>"
  },
  "longTermImpact": {
    "healthTrend": "<long-term health trajectory with daily consumption over months/years>",
    "metabolicImpact": "<effect on metabolism and body composition>",
    "riskAccumulation": "<chronic disease risk factors elevated by this drink>",
    "nutritionalBalance": "<overall nutritional contribution or deficit>"
  },
  "composition": {
    "calories": <integer>,
    "sugarGrams": <float>,
    "caffeineMg": <float>,
    "additives": ["<additive1>", "<additive2>"],
    "ingredients": [
      {
        "name": "<ingredient name>",
        "function": "<biological function in the body>",
        "healthRole": "<positive|neutral|concerning>",
        "riskLevel": "<low|medium|high>"
      }
    ]
  }
}

Score guidelines: water=95-100, herbal tea=85-95, black coffee=70-80, green juice=75-90, milk=65-75, sport drinks=50-65, juice with sugar=40-60, soda=20-40, energy drinks=15-35, alcohol=5-25.
Status: optimal(80-100), stable(50-79), risky(25-49), damaging(0-24).`;

router.post("/scans/analyze", async (req, res) => {
  try {
    const imageBase64 = req.body?.imageBase64;
    if (!imageBase64 || typeof imageBase64 !== "string") {
      res.status(400).json({ error: "imageBase64 is required" });
      return;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: "high",
              },
            },
            {
              type: "text",
              text: ANALYSIS_PROMPT,
            },
          ],
        },
      ],
      max_tokens: 2000,
    });

    const content = completion.choices[0]?.message?.content ?? "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      req.log.error({ content }, "No JSON found in OpenAI response");
      res.status(500).json({ error: "Failed to parse AI analysis" });
      return;
    }

    const result = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    if (!result.id || typeof result.id !== "string") {
      result.id = `scan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
    }

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to analyze scan");
    res.status(500).json({ error: "Failed to analyze drink image" });
  }
});

export default router;
