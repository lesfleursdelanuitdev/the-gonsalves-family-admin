/** Types for GET /api/research/trees/:id/analytics/* (Ligneous Python API). */

export type AnalyticsFrequencyBucket = {
  bucket: string;
  count: number;
};

export type AnalyticsGivenNamesSummary = {
  total_unique_names?: number;
  total_individuals_with_names?: number;
  names_appearing_once?: number;
  names_2_to_9?: number;
  names_10_plus?: number;
};

export type AnalyticsTopNameRow = {
  id?: string;
  name: string;
  frequency: number;
};

export type GivenNamesAnalyticsResponse = {
  tree_id: string;
  summary: AnalyticsGivenNamesSummary;
  top_names: AnalyticsTopNameRow[];
  frequency_distribution: AnalyticsFrequencyBucket[];
};

export type AnalyticsSurnamesSummary = {
  total_unique_surnames?: number;
  total_occurrences?: number;
  surnames_appearing_once?: number;
  surnames_2_to_9?: number;
  surnames_10_plus?: number;
};

export type SurnamesAnalyticsResponse = {
  tree_id: string;
  summary: AnalyticsSurnamesSummary;
  top_surnames: AnalyticsTopNameRow[];
  frequency_distribution: AnalyticsFrequencyBucket[];
};

export type AdminStatisticsAnalyticsPayload = {
  treeId: string;
  givenNames: GivenNamesAnalyticsResponse;
  surnames: SurnamesAnalyticsResponse;
};
