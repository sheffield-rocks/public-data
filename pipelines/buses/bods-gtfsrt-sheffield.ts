/**
 * How to run
 *
 * 1) Install deps (Bun)
 *    bun add protobufjs yauzl
 *
 * 2) Run with Bun (Bun loads .env automatically)
 *    bun run bods-gtfsrt-sheffield.ts --prefix 370
 *    bun run bods-gtfsrt-sheffield.ts --source "https://data.bus-data.dft.gov.uk/api/v1/gtfsrtdatafeed/"
 *
 * 3) Example compiled usage (optional)
 *    bunx tsc bods-gtfsrt-sheffield.ts --target es2022 --module node16 --moduleResolution node16 --outDir dist
 *    node dist/bods-gtfsrt-sheffield.js --prefix 370
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import * as protobuf from "protobufjs";
import yauzl from "yauzl";

// NOTE: If this endpoint changes, find the current GTFS-RT datafeed URL in the BODS API docs
// (BODS website -> API -> datafeed/gtfsrt). You can also pass --source to override.
const DEFAULT_SOURCE = "https://data.bus-data.dft.gov.uk/api/v1/gtfsrtdatafeed/";

const GTFS_REALTIME_PROTO = `syntax = "proto2";
package transit_realtime;

option java_package = "com.google.transit.realtime";
option java_outer_classname = "GtfsRealtime";

message FeedMessage {
  required FeedHeader header = 1;
  repeated FeedEntity entity = 2;
}

message FeedHeader {
  required string gtfs_realtime_version = 1;
  optional Incrementality incrementality = 2 [default = FULL_DATASET];
  optional uint64 timestamp = 3;
}

enum Incrementality {
  FULL_DATASET = 0;
  DIFFERENTIAL = 1;
}

message FeedEntity {
  required string id = 1;
  optional bool is_deleted = 2 [default = false];
  optional TripUpdate trip_update = 3;
  optional VehiclePosition vehicle = 4;
  optional Alert alert = 5;
}

message TripUpdate {
  optional TripDescriptor trip = 1;
  optional VehicleDescriptor vehicle = 3;
  repeated StopTimeUpdate stop_time_update = 2;
  optional uint64 timestamp = 4;
  optional int32 delay = 5;
}

message StopTimeUpdate {
  optional uint32 stop_sequence = 1;
  optional string stop_id = 4;
  optional StopTimeEvent arrival = 2;
  optional StopTimeEvent departure = 3;
  optional ScheduleRelationship schedule_relationship = 5 [default = SCHEDULED];
}

message StopTimeEvent {
  optional int32 delay = 1;
  optional int64 time = 2;
  optional int32 uncertainty = 3;
}

message VehiclePosition {
  optional TripDescriptor trip = 1;
  optional VehicleDescriptor vehicle = 8;
  optional Position position = 2;
  optional uint32 current_stop_sequence = 3;
  optional string stop_id = 7;
  optional VehicleStopStatus current_status = 4 [default = IN_TRANSIT_TO];
  optional uint64 timestamp = 5;
  optional CongestionLevel congestion_level = 6;
  optional OccupancyStatus occupancy_status = 9;
  optional OccupancyPercentage occupancy_percentage = 10;
}

message Alert {
  repeated TimeRange active_period = 1;
  repeated EntitySelector informed_entity = 5;
  optional Cause cause = 6 [default = UNKNOWN_CAUSE];
  optional Effect effect = 7 [default = UNKNOWN_EFFECT];
  repeated TranslatedString url = 8;
  repeated TranslatedString header_text = 10;
  repeated TranslatedString description_text = 11;
  repeated TranslatedString tts_header_text = 12;
  repeated TranslatedString tts_description_text = 13;
  repeated TranslatedString image = 14;
  repeated TranslatedString image_alternative_text = 15;
  optional SeverityLevel severity_level = 16 [default = UNKNOWN_SEVERITY];
}

message TimeRange {
  optional uint64 start = 1;
  optional uint64 end = 2;
}

message EntitySelector {
  optional string agency_id = 1;
  optional string route_id = 2;
  optional int32 route_type = 3;
  optional TripDescriptor trip = 4;
  optional string stop_id = 5;
}

enum Cause {
  UNKNOWN_CAUSE = 1;
  OTHER_CAUSE = 2;
  TECHNICAL_PROBLEM = 3;
  STRIKE = 4;
  DEMONSTRATION = 5;
  ACCIDENT = 6;
  HOLIDAY = 7;
  WEATHER = 8;
  MAINTENANCE = 9;
  CONSTRUCTION = 10;
  POLICE_ACTIVITY = 11;
  MEDICAL_EMERGENCY = 12;
}

enum Effect {
  NO_SERVICE = 1;
  REDUCED_SERVICE = 2;
  SIGNIFICANT_DELAYS = 3;
  DETOUR = 4;
  ADDITIONAL_SERVICE = 5;
  MODIFIED_SERVICE = 6;
  OTHER_EFFECT = 7;
  UNKNOWN_EFFECT = 8;
  STOP_MOVED = 9;
  NO_EFFECT = 10;
  ACCESSIBILITY_ISSUE = 11;
}

message TripDescriptor {
  optional string trip_id = 1;
  optional string route_id = 5;
  optional string direction_id = 6;
  optional string start_time = 2;
  optional string start_date = 3;
  optional ScheduleRelationship schedule_relationship = 4 [default = SCHEDULED];
}

message VehicleDescriptor {
  optional string id = 1;
  optional string label = 2;
  optional string license_plate = 3;
}

enum ScheduleRelationship {
  SCHEDULED = 0;
  ADDED = 1;
  UNSCHEDULED = 2;
  CANCELED = 3;
  REPLACEMENT = 5;
  DUPLICATED = 6;
  DELETED = 7;
}

message Position {
  required float latitude = 1;
  required float longitude = 2;
  optional float bearing = 3;
  optional double odometer = 4;
  optional float speed = 5;
}

enum VehicleStopStatus {
  INCOMING_AT = 0;
  STOPPED_AT = 1;
  IN_TRANSIT_TO = 2;
}

enum CongestionLevel {
  UNKNOWN_CONGESTION_LEVEL = 0;
  RUNNING_SMOOTHLY = 1;
  STOP_AND_GO = 2;
  CONGESTION = 3;
  SEVERE_CONGESTION = 4;
}

enum OccupancyStatus {
  EMPTY = 0;
  MANY_SEATS_AVAILABLE = 1;
  FEW_SEATS_AVAILABLE = 2;
  STANDING_ROOM_ONLY = 3;
  CRUSHED_STANDING_ROOM_ONLY = 4;
  FULL = 5;
  NOT_ACCEPTING_PASSENGERS = 6;
  NO_DATA_AVAILABLE = 7;
  NOT_BOARDABLE = 8;
}

enum OccupancyPercentage {
  EMPTY_PERCENTAGE = 0;
  MANY_SEATS_AVAILABLE_PERCENTAGE = 1;
  FEW_SEATS_AVAILABLE_PERCENTAGE = 2;
  STANDING_ROOM_ONLY_PERCENTAGE = 3;
  CRUSHED_STANDING_ROOM_ONLY_PERCENTAGE = 4;
  FULL_PERCENTAGE = 5;
  NO_DATA_AVAILABLE_PERCENTAGE = 6;
  NOT_BOARDABLE_PERCENTAGE = 7;
}

message TranslatedString {
  repeated Translation translation = 1;
}

message Translation {
  required string text = 1;
  optional string language = 2;
}
`;

type OutputFormat = "json" | "pb";

type FeedObject = {
  header?: Record<string, unknown>;
  entity?: Array<Record<string, unknown>>;
};

type FilterSummary = {
  totalEntities: number;
  keptEntities: number;
  totalStopRefsChecked: number;
  keptStopRefs: number;
};

type FilteredFeed = {
  header: Record<string, unknown>;
  entities: Array<Record<string, unknown>>;
  summary: FilterSummary;
};

type FeedBundle = {
  name: string;
  filtered: FilteredFeed;
};

type CliOptions = {
  prefix: string;
  out: string;
  format: OutputFormat;
  source?: string;
  apiKey?: string;
};

function getEnvApiKey(): string | undefined {
  const fromProcess = process.env.BODS_API_KEY;
  if (fromProcess) return fromProcess;
  const bunEnv = (globalThis as any).Bun?.env?.BODS_API_KEY as string | undefined;
  return bunEnv;
}

function resolveDataRoot(): string {
  const cwd = process.cwd();
  const pipelineSuffix = path.join("pipelines", "buses");
  if (cwd.endsWith(pipelineSuffix)) {
    return path.join(cwd, "..", "..");
  }
  return cwd;
}

function getDefaultOutPath(): string {
  const dataDir = process.env.SHEFFIELD_DATA_DIR;
  if (dataDir) {
    return path.join(dataDir, "data", "buses", "sheffield-gtfsrt.json");
  }
  const root = resolveDataRoot();
  return path.join(root, "data", "buses", "sheffield-gtfsrt.json");
}

function parseArgs(argv: string[]): CliOptions {
  const args = argv.slice(2);
  const options: CliOptions = {
    prefix: "370",
    out: getDefaultOutPath(),
    format: "json",
    source: undefined,
    apiKey: undefined,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--prefix") {
      options.prefix = args[i + 1] ?? options.prefix;
      i += 1;
    } else if (arg === "--out") {
      options.out = args[i + 1] ?? options.out;
      i += 1;
    } else if (arg === "--format") {
      const value = args[i + 1] as OutputFormat | undefined;
      if (value === "json" || value === "pb") {
        options.format = value;
      }
      i += 1;
    } else if (arg === "--source") {
      options.source = args[i + 1];
      i += 1;
    } else if (arg === "--apiKey") {
      options.apiKey = args[i + 1];
      i += 1;
    }
  }

  if (!options.apiKey) {
    options.apiKey = getEnvApiKey();
  }

  return options;
}

function logInfo(message: string): void {
  process.stdout.write(`${message}\n`);
}

function logWarn(message: string): void {
  process.stderr.write(`WARN: ${message}\n`);
}

function logError(message: string): void {
  process.stderr.write(`ERROR: ${message}\n`);
}

function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has("api_key")) {
      parsed.searchParams.set("api_key", "REDACTED");
    }
    return parsed.toString();
  } catch {
    return url.replace(/api_key=([^&]+)/gi, "api_key=REDACTED");
  }
}

function detectFeedName(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.includes("trip") || lower.includes("tu")) return "tripUpdates";
  if (lower.includes("vehicle") || lower.includes("vp")) return "vehiclePositions";
  if (lower.includes("alert") || lower.includes("sa")) return "serviceAlerts";
  return "unknown";
}

async function downloadToTempFile(url: string, apiKey?: string): Promise<string> {
  logInfo(`Downloading: ${sanitizeUrl(url)}`);
  const headers: Record<string, string> = {};
  if (apiKey) {
    // BODS APIs typically accept api_key query param. Some endpoints also accept header-based keys.
    // If your endpoint requires a header, set --apiKey and add it here (adjust as needed).
    headers["x-api-key"] = apiKey;
  }

  const response = await fetch(url, { headers });
  if (response.status === 401 || response.status === 403) {
    throw new Error(`Auth failed (${response.status}). Check API key or permissions.`);
  }
  if (!response.ok || !response.body) {
    throw new Error(`Network error: ${response.status} ${response.statusText}`);
  }

  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "bods-gtfsrt-"));
  const tmpFile = path.join(tmpDir, "download.bin");
  await pipeline(Readable.fromWeb(response.body as any), fs.createWriteStream(tmpFile));
  return tmpFile;
}

async function readMagicBytes(filePath: string, count = 4): Promise<Buffer> {
  const handle = await fsp.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(count);
    await handle.read(buffer, 0, count, 0);
    return buffer;
  } finally {
    await handle.close();
  }
}

function isZipMagic(magic: Buffer): boolean {
  return magic.length >= 4 && magic[0] === 0x50 && magic[1] === 0x4b && magic[2] === 0x03 && magic[3] === 0x04;
}

async function readZipEntries(filePath: string): Promise<Array<{ name: string; buffer: Buffer }>> {
  logInfo("Extracting ZIP...");
  return new Promise((resolve, reject) => {
    const entries: Array<{ name: string; buffer: Buffer }> = [];
    yauzl.open(filePath, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) {
        reject(err ?? new Error("Failed to open ZIP"));
        return;
      }

      zipfile.on("error", reject);
      zipfile.readEntry();
      zipfile.on("entry", (entry) => {
        if (/\/$/.test(entry.fileName)) {
          zipfile.readEntry();
          return;
        }
        zipfile.openReadStream(entry, (streamErr, readStream) => {
          if (streamErr || !readStream) {
            reject(streamErr ?? new Error("Failed to read ZIP entry"));
            return;
          }
          const chunks: Buffer[] = [];
          readStream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
          readStream.on("end", () => {
            entries.push({ name: entry.fileName, buffer: Buffer.concat(chunks) });
            zipfile.readEntry();
          });
          readStream.on("error", reject);
        });
      });

      zipfile.on("end", () => resolve(entries));
    });
  });
}

function decodeFeedMessage(buffer: Buffer): FeedObject {
  const root = protobuf.parse(GTFS_REALTIME_PROTO).root;
  const FeedMessage = root.lookupType("transit_realtime.FeedMessage");
  const message = FeedMessage.decode(buffer);
  const object = FeedMessage.toObject(message, {
    longs: String,
    enums: String,
    bytes: String,
    defaults: false,
    arrays: true,
    objects: true,
    oneofs: true,
  }) as FeedObject;
  return object;
}

function filterFeed(feed: FeedObject, prefix: string): FilteredFeed {
  const header = (feed.header ?? {}) as Record<string, unknown>;
  const entities = Array.isArray(feed.entity) ? feed.entity : [];

  const summary: FilterSummary = {
    totalEntities: entities.length,
    keptEntities: 0,
    totalStopRefsChecked: 0,
    keptStopRefs: 0,
  };

  const keptEntities: Array<Record<string, unknown>> = [];

  for (const entity of entities) {
    const tripUpdate = (entity as any).trip_update;
    const alert = (entity as any).alert;
    const vehicle = (entity as any).vehicle;

    let keep = false;

    if (tripUpdate?.stop_time_update && Array.isArray(tripUpdate.stop_time_update)) {
      const keptStopTimeUpdates = [] as any[];
      for (const stu of tripUpdate.stop_time_update) {
        const stopId = stu?.stop_id;
        if (typeof stopId === "string") {
          summary.totalStopRefsChecked += 1;
          if (stopId.startsWith(prefix)) {
            summary.keptStopRefs += 1;
            keep = true;
            keptStopTimeUpdates.push(stu);
          }
        }
      }
      if (keep) {
        // Optional pruning of StopTimeUpdates to only matching stops
        (entity as any).trip_update = {
          ...tripUpdate,
          stop_time_update: keptStopTimeUpdates,
        };
      }
    }

    if (!keep && alert?.informed_entity && Array.isArray(alert.informed_entity)) {
      const keptInformed = [] as any[];
      for (const info of alert.informed_entity) {
        const stopId = info?.stop_id;
        if (typeof stopId === "string") {
          summary.totalStopRefsChecked += 1;
          if (stopId.startsWith(prefix)) {
            summary.keptStopRefs += 1;
            keep = true;
            keptInformed.push(info);
          }
        }
      }
      if (keep) {
        // Optional pruning of informed_entity to only matching stops
        (entity as any).alert = {
          ...alert,
          informed_entity: keptInformed,
        };
      }
    }

    // Vehicle Positions generally don't include stop IDs; keep them as-is.
    if (!keep && vehicle) {
      keep = true;
    }

    if (keep) {
      keptEntities.push(entity as Record<string, unknown>);
    }
  }

  summary.keptEntities = keptEntities.length;

  return {
    header,
    entities: keptEntities,
    summary,
  };
}

function buildSummaryBlock(
  bundles: FeedBundle[],
  prefix: string,
  source: string,
): Record<string, unknown> {
  const totalEntities = bundles.reduce((acc, b) => acc + b.filtered.summary.totalEntities, 0);
  const keptEntities = bundles.reduce((acc, b) => acc + b.filtered.summary.keptEntities, 0);
  const totalStopRefsChecked = bundles.reduce((acc, b) => acc + b.filtered.summary.totalStopRefsChecked, 0);
  const keptStopRefs = bundles.reduce((acc, b) => acc + b.filtered.summary.keptStopRefs, 0);

  return {
    totalEntities,
    keptEntities,
    totalStopRefsChecked,
    keptStopRefs,
    prefix,
    source: sanitizeUrl(source),
    generatedAt: new Date().toISOString(),
  };
}

function encodeFeedMessage(filtered: FilteredFeed): Buffer {
  const root = protobuf.parse(GTFS_REALTIME_PROTO).root;
  const FeedMessage = root.lookupType("transit_realtime.FeedMessage");
  const message = FeedMessage.fromObject({
    header: filtered.header,
    entity: filtered.entities,
  });
  return Buffer.from(FeedMessage.encode(message).finish());
}

async function writeJsonOutput(
  bundles: FeedBundle[],
  summary: Record<string, unknown>,
  outPath: string,
): Promise<void> {
  const output: Record<string, unknown> = {};

  if (bundles.length === 1) {
    output.header = bundles[0].filtered.header;
    output.entities = bundles[0].filtered.entities;
  } else {
    const feeds: Record<string, unknown> = {};
    for (const bundle of bundles) {
      feeds[bundle.name] = {
        header: bundle.filtered.header,
        entities: bundle.filtered.entities,
      };
    }
    output.feeds = feeds;
  }

  output.summary = summary;

  await fsp.writeFile(outPath, JSON.stringify(output, null, 2));
}

export async function runWithOptions(options: CliOptions): Promise<{ bundles: FeedBundle[]; summary: Record<string, unknown>; url: string }> {
  const source = options.source ?? DEFAULT_SOURCE;
  const url = options.apiKey && source.includes("api_key=")
    ? source
    : options.apiKey
      ? `${source}${source.includes("?") ? "&" : "?"}api_key=${encodeURIComponent(options.apiKey)}`
      : source;

  if (!url) {
    throw new Error("No source URL provided. Use --source or set DEFAULT_SOURCE.");
  }

  logInfo("Starting BODS GTFS-RT download...");

  const tmpFile = await downloadToTempFile(url, options.apiKey);
  const magic = await readMagicBytes(tmpFile);
  const isZip = isZipMagic(magic);

  const buffers: Array<{ name: string; buffer: Buffer }> = [];

  if (isZip) {
    const entries = await readZipEntries(tmpFile);
    const pbEntries = entries.filter((entry) => {
      const lower = entry.name.toLowerCase();
      return lower.endsWith(".pb") || lower.endsWith(".bin") || lower.endsWith(".protobuf") || lower.includes("gtfsrt");
    });

    if (pbEntries.length === 0) {
      throw new Error("ZIP missing expected .pb files.");
    }

    buffers.push(...pbEntries);
  } else {
    const buffer = await fsp.readFile(tmpFile);
    buffers.push({ name: "feed.pb", buffer });
  }

  logInfo("Decoding protobuf...");

  const bundles: FeedBundle[] = [];
  for (const entry of buffers) {
    try {
      const feed = decodeFeedMessage(entry.buffer);
      const filtered = filterFeed(feed, options.prefix);
      bundles.push({ name: detectFeedName(entry.name), filtered });
    } catch (err) {
      throw new Error(`Protobuf decode failed for ${entry.name}: ${(err as Error).message}`);
    }
  }

  if (bundles.length === 0) {
    throw new Error("No decodable GTFS-RT feeds found.");
  }

  const summary = buildSummaryBlock(bundles, options.prefix, url);

  const totalKept = summary.keptEntities as number;
  if (totalKept === 0) {
    logWarn("No entities matched the prefix. Writing empty feed with header only.");
  }

  return { bundles, summary, url };
}

export async function writeOutput(options: CliOptions, bundles: FeedBundle[], summary: Record<string, unknown>): Promise<void> {
  logInfo("Writing output...");

  if (options.format === "json") {
    await writeJsonOutput(bundles, summary, options.out);
  } else {
    if (bundles.length !== 1) {
      throw new Error("PB output supports a single feed only. Use --format json for multiple feeds.");
    }
    const buffer = encodeFeedMessage(bundles[0].filtered);
    await fsp.writeFile(options.out, buffer);
  }
}

export async function main(): Promise<void> {
  const options = parseArgs(process.argv);
  const { bundles, summary } = await runWithOptions(options);
  await writeOutput(options, bundles, summary);
  logInfo(`Done. Wrote ${options.out}`);
}

if ((globalThis as any).Bun?.main ?? (import.meta as any).main) {
  main().catch((err) => {
    logError(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
