export interface SessionInfo {
  id: string;
  city: string;
  title: string;
  date: string;
  video_url: string;
  video_start_time: string;
  video_anchor_offset_seconds?: number;
  timezone: string;
  source_note?: string;
  subtitles_url?: string | null;
  transcript_url?: string | null;
  summary_url?: string | null;
}

export interface Speaker {
  id: string;
  name: string;
  display_name?: string | null;
  party: string | null;
  role: string;
  speaker_type: string;
  email?: string | null;
  is_council_member: boolean;
  source_name?: string | null;
}

export interface Speech {
  id: string;
  session_id: string;
  chapter_id: string;
  sequence_in_chapter: number;
  speaker_id: string;
  speaker_name_raw: string;
  note: string | null;
  absolute_start_time: string;
  video_offset_seconds: number;
  speech_type: string;
  speech_type_code: string;
  end_offset_seconds: number | null;
  end_absolute_time: string | null;
}

export interface Chapter {
  id: string;
  number: string | null;
  title: string;
  absolute_start_time: string;
  video_offset_seconds: number;
  sort_order: number;
  speeches: Speech[];
  end_offset_seconds: number | null;
  end_absolute_time: string | null;
}

export interface TranscriptSegment {
  id: string;
  start_video_seconds: number;
  end_video_seconds: number;
  text: string;
}

export interface TranscriptData {
  schema_version: string;
  source: string;
  offset_seconds_applied: number;
  segments: TranscriptSegment[];
}

export interface SessionMetadata {
  schema_version: string;
  session: SessionInfo;
  speakers: Speaker[];
  chapters: Chapter[];
}

export interface SessionSummarySection {
  id: string;
  title: string;
  content: string;
}

export interface SessionSummary {
  schema_version: string;
  title: string;
  short_summary: string;
  sections: SessionSummarySection[];
}

export interface SessionSummaryHighlight {
  id: string;
  title: string;
  chapter_label: string;
  session_clock: string;
  tone: 'controversial' | 'dramatic' | 'interesting';
  description: string;
}

export interface SessionSummary {
  schema_version: string;
  title: string;
  short_summary: string;
  sections: SessionSummarySection[];
  highlights?: SessionSummaryHighlight[];
  footer_note?: string;
}