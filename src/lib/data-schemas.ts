import { z } from "zod";

export const WeatherDataSchema = z.object({
  temperature: z.number().min(-50).max(60),
  humidity: z.number().min(0).max(100),
  windSpeed: z.number().min(0).max(100),
  condition: z.string(),
  timestamp: z.number(),
  source: z.literal("open-meteo").default("open-meteo"),
});

export const AirQualitySchema = z.object({
  aqi: z.number().min(0).max(500),
  pm25: z.number().min(0).max(500),
  pm10: z.number().min(0).max(500),
  no2: z.number().min(0),
  o3: z.number().min(0),
  timestamp: z.number(),
  source: z.literal("open-meteo").default("open-meteo"),
});

export const DamDataSchema = z.object({
  name: z.string(),
  capacity: z.number().min(0).max(100),
  water_level: z.number().min(0).max(100),
  timestamp: z.number(),
  lastUpdate: z.string(),
  source: z.literal("manual-survey").default("manual-survey"),
});

export const EconomyDataSchema = z.object({
  unemployment_rate: z.number().min(0).max(100),
  inflation_rate: z.number(),
  gdp_growth: z.number(),
  new_companies: z.number().min(0),
  timestamp: z.number(),
  source: z.literal("turkish-statistics").default("turkish-statistics"),
});

export const TourismDataSchema = z.object({
  monthly_visitors: z.number().min(0),
  hotel_occupancy: z.number().min(0).max(100),
  avg_stay_days: z.number().min(1).max(30),
  year_to_date: z.number().min(0),
  timestamp: z.number(),
  source: z.literal("tourism-board").default("tourism-board"),
});

export const TrafficDataSchema = z.object({
  main_arterial_density: z.number().min(0).max(1),
  secondary_road_density: z.number().min(0).max(1),
  congestion_level: z.enum(["clear", "light", "moderate", "heavy", "severe"]),
  incident_count: z.number().min(0),
  timestamp: z.number(),
  source: z.literal("manual-observation").default("manual-observation"),
});

export const NewsDataSchema = z.object({
  title: z.string(),
  source: z.string(),
  category: z.enum(["economy", "tourism", "environment", "security", "health", "culture"]),
  url: z.string().url(),
  published_at: z.number(),
  data_timestamp: z.number(),
  source_type: z.literal("rss").default("rss"),
});

export const DataSourceSchema = z.object({
  category: z.string(),
  source_name: z.string(),
  is_free: z.boolean(),
  is_reliable: z.boolean(),
  refresh_interval_minutes: z.number().min(1),
  last_update: z.number(),
  health_status: z.enum(["healthy", "degraded", "failing", "unknown"]),
  error_message: z.string().optional(),
});

export const DataQualityMetricSchema = z.object({
  category: z.string(),
  timestamp: z.number(),
  data_age_minutes: z.number(),
  is_fresh: z.boolean(),
  has_real_source: z.boolean(),
  validation_status: z.enum(["valid", "invalid", "partial", "unknown"]),
  source: z.string(),
  last_error: z.string().optional(),
});

export type WeatherData = z.infer<typeof WeatherDataSchema>;
export type AirQuality = z.infer<typeof AirQualitySchema>;
export type DamData = z.infer<typeof DamDataSchema>;
export type EconomyData = z.infer<typeof EconomyDataSchema>;
export type TourismData = z.infer<typeof TourismDataSchema>;
export type TrafficData = z.infer<typeof TrafficDataSchema>;
export type NewsData = z.infer<typeof NewsDataSchema>;
export type DataSource = z.infer<typeof DataSourceSchema>;
export type DataQualityMetric = z.infer<typeof DataQualityMetricSchema>;
