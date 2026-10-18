// Writes synthetic export ZIPs to frontend/.fixtures/ (gitignored). Usage: node scripts/make-fixtures.mjs [outDir]
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync, crc32 } from "node:zlib";
import { generate } from "../src/sample/generate.ts";

const here = dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] ?? join(here, "..", ".fixtures");
mkdirSync(out, { recursive: true });

function zip(entries) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name);
    const raw = Buffer.from(data);
    const comp = deflateRawSync(raw);
    const crc = crc32(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    parts.push(local, nameBuf, comp);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(0x0800, 8);
    c.writeUInt16LE(8, 10);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(comp.length, 20);
    c.writeUInt32LE(raw.length, 24);
    c.writeUInt16LE(nameBuf.length, 28);
    c.writeUInt32LE(offset, 42);
    central.push(c, nameBuf);
    offset += 30 + nameBuf.length + comp.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, end]);
}

/** Split rows into Streaming_History_Audio_<range>_<n>.json files of `size` rows. */
function extendedEntries(rows, size = 20000) {
  const entries = [];
  for (let i = 0, n = 0; i < rows.length; i += size, n++) {
    entries.push({
      name: `Spotify Extended Streaming History/Streaming_History_Audio_${n}.json`,
      data: JSON.stringify(rows.slice(i, i + size), null, 2),
    });
  }
  return entries;
}

const fmt = (ts) => ts.slice(0, 16).replace("T", " ");

function accountEntries(rows) {
  const music = [];
  const pod = [];
  for (const r of rows) {
    if (r.master_metadata_track_name) {
      music.push({ endTime: fmt(r.ts), artistName: r.master_metadata_album_artist_name, trackName: r.master_metadata_track_name, msPlayed: r.ms_played });
    } else {
      pod.push({ endTime: fmt(r.ts), podcastName: r.episode_show_name, episodeName: r.episode_name, msPlayed: r.ms_played });
    }
  }
  const entries = [];
  for (let i = 0, n = 0; i < music.length; i += 10000, n++) {
    entries.push({ name: `Spotify Account Data/StreamingHistory_music_${n}.json`, data: JSON.stringify(music.slice(i, i + 10000), null, 2) });
  }
  entries.push({ name: "Spotify Account Data/StreamingHistory_podcast_0.json", data: JSON.stringify(pod, null, 2) });
  entries.push({ name: "Spotify Account Data/Userdata.json", data: JSON.stringify({ username: "fixture-user" }) });
  return entries;
}

const write = (name, buf) => {
  writeFileSync(join(out, name), buf);
  console.log(`${name}  ${(buf.length / 1048576).toFixed(1)} MB`);
};

write("extended.zip", zip(extendedEntries(generate(1))));
write("account.zip", zip(accountEntries(generate(2))));
write("canary.zip", zip(extendedEntries(generate(3, { years: 1, namePrefix: "ZZCANARY " }))));

const good = zip(extendedEntries(generate(4, { years: 1 })));
write("corrupt.zip", Buffer.concat([good.subarray(0, Math.floor(good.length / 2)), Buffer.from("not a zip tail")]));

// perf set: ~50 MB of uncompressed JSON (the zip itself is smaller)
const perfEntries = [];
let perfBytes = 0;
for (let seed = 100; perfBytes < 50 * 1048576; seed++) {
  for (const e of extendedEntries(generate(seed, { playsPerDay: 24 }), 50000)) {
    perfBytes += Buffer.byteLength(e.data);
    perfEntries.push({ name: `Spotify Extended Streaming History/Streaming_History_Audio_${perfEntries.length}.json`, data: e.data });
  }
}
write("perf.zip", zip(perfEntries));
