//-----------------------------------------------------------
enum IsOff {
    On = 0x00,
    Off = 0x01
};

enum IsInUse {
    No = 0x00,
    Yes = 0x02
};

enum ZoneMidiPortValue {
    USB = 0,
    Midi1 = 1,
    Midi2 = 2,
    BT = 3
}

enum VelocityCurveType {
    Factory = 0,
    User = 0x55
};

enum ZoneEnableMode {
    Disabled = 0,
    Off = 1,
    On = 2
}

enum ZoneCurveType {
    // BIT PATTERN:       A B CCC DD
    //  DD = (0-3)  Linear / Hill / Ramp     selected
    //  CC = (0-6)  Selected user curve
    //   B = (0x00|0x40) 0 = factory curve, 1= User curve
    //   A = (0x80|0x00) 0 = any, 1 = fixed velocity
    Linear = 0x14,
    HillCurve = 0x15,
    RampCurve = 0x16,
    Fixed = 0x96,
    User1 = 0x42,
    User2 = 0x46,
    User3 = 0x4a,
    User4 = 0x4e,
    User5 = 0x52,
    User6 = 0x56
}

enum StickAssignment {
    Off = 0,
    Pitchbend,
    Aftertouch,
    Modulation,
    Breath,
    CC03
}

enum PedalAssignment {
    Off = 0,
    Aftertouch,
    Modulation,
    Breath,
    CC03
}


type StickAssign = 'Off' | 'Pitchbend' | 'Aftertouch' | number;
type PedalAssign = 'Off' | 'Aftertouch' | 'Damper' | number;

///---------------------------------------

interface DataGetter {
    getData(offset: number, length: number): number[]
    setData(offset: number, length: number, value: number[]): void;
}

class ZoneData {
    constructor(public patch: PatchData, public zone: number) { }
    get data() { return this.patch.data; }

    sound!: string;
    instrument!: string;
    enabled!: keyof typeof ZoneEnableMode;
    midiPort!: keyof typeof ZoneMidiPortValue;
    volume!: number;
    midiChannel!: number;
    programChange!: number;
    MSB!: number;
    LSB!: number;
    lowKey!: number;
    highKey!: number;
    lowVel!: number;
    highVel!: number;
    octave!: number;
    transpose!: number;
    afterTouch!: number;
    stick1X!: StickAssign;
    stick1Y!: StickAssign;
    stick2X!: StickAssign;
    stick2Y!: StickAssign;
    stick3X!: StickAssign;
    stick3Y!: StickAssign;
    pedal1!: PedalAssign;
    pedal2!: PedalAssign;
    pedal3!: PedalAssign;
    pedal4!: PedalAssign;
    curveType!: keyof typeof ZoneCurveType;
    fixedVelocity!: number;
};

class PatchData {
    static template: number[] = [85, 83, 76, 32, 56, 56, 32, 71, 82, 65, 78, 68, 0, 32, 32, 32, 0, 0, 0, 0, 0, 0, 0, 0, 73, 78, 83, 84, 82, 85, 77, 69, 78, 84, 0, 32, 73, 78, 83, 84, 82, 85, 77, 69, 78, 84, 0, 32, 73, 78, 83, 84, 82, 85, 77, 69, 78, 84, 0, 32, 73, 78, 83, 84, 82, 85, 77, 69, 78, 84, 0, 32, 83, 79, 85, 78, 68, 0, 32, 32, 32, 32, 32, 83, 79, 85, 78, 68, 0, 32, 32, 32, 32, 32, 83, 79, 85, 78, 68, 0, 32, 32, 32, 32, 32, 83, 79, 85, 78, 68, 0, 32, 32, 32, 32, 32, 2, 2, 2, 2, 0, 0, 1, 2, 0, 1, 0, 1, 127, 127, 127, 127, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 21, 21, 21, 21, 108, 108, 108, 108, 0, 0, 0, 0, 127, 127, 127, 127, 1, 1, 1, 1, 3, 3, 3, 3, 12, 12, 12, 12, 1, 1, 1, 1, 100, 100, 100, 100, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 75, 75, 75, 75, 72, 72, 72, 72, 0, 0, 0, 0, 65, 65, 65, 65, 68, 68, 68, 68, 12, 12, 12, 12, 12, 12, 12, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    static propertyMap: Dict<keyof PatchData | keyof ZoneData> = {};

    static {
        type HasDataGetter = {
            data: DataGetter;
            zone: number;
        };

        function define<K>(caller: HasDataGetter, name: keyof PatchData | keyof ZoneData, offset: number, length: number, decode: (x: number[]) => K, encode: (x: K) => number[]) {
            PatchData.propertyMap[offset] = name;
            Object.defineProperty(caller, name, {
                get: function (this: HasDataGetter) { return decode(this.data.getData(offset + (this.zone * length), length)) },
                set: function (this: HasDataGetter, value: any) { this.data.setData(offset + (this.zone * length), length, encode(value)); }
            });
        }

        function defineString(caller: HasDataGetter, name: keyof PatchData | keyof ZoneData, offset: number, length: number) {
            define(caller, name, offset, length, unicodes2string, s => string2unicodes(s, length));
        }

        function defineWord(caller: HasDataGetter, name: keyof PatchData | keyof ZoneData, offset: number) {
            define<number>(caller, name, offset, 1, v => v[0], v => [v]);
        }

        function defineEnum(caller: HasDataGetter, name: keyof PatchData | keyof ZoneData, offset: number, enumobj: any) {
            define<string>(caller, name, offset, 1, v => enumobj[v[0]], v => [enumobj[v]]);
        }

        function defineX(caller: HasDataGetter, name: keyof ZoneData, offset: number, ...args: string[]) {
            define(caller, name, offset, 1,
                v => (args[v[0]] ?? v[0] - args.length),
                v => [typeof v === "number" ? (v + args.length) : args.indexOf(v)]
            );
        }

        function defineStick(caller: HasDataGetter, name: keyof ZoneData, offset: number) {
            defineX(caller, name, offset, 'Off', 'Pitchbend', 'Aftertouch');
        }

        function definePedal(caller: HasDataGetter, name: keyof ZoneData, offset: number) {
            defineX(caller, name, offset, 'Off', 'Aftertouch');
        }

        defineString(this.prototype, "name", 0x01, 0xe);
        defineString(ZoneData.prototype, "instrument", 0x18, 0xc);
        defineString(ZoneData.prototype, "sound", 0x48, 0xb);
        defineEnum(ZoneData.prototype, "enabled", 0x74, ZoneEnableMode);
        defineWord(ZoneData.prototype, "midiChannel", 0x7c);
        defineEnum(ZoneData.prototype, "midiPort", 0x78, ZoneMidiPortValue);
        defineWord(ZoneData.prototype, "volume", 0x80);
        defineWord(ZoneData.prototype, "programChange", 0x84);
        defineWord(ZoneData.prototype, "MSB", 0x88);
        defineWord(ZoneData.prototype, "LSB", 0x8c);
        defineWord(ZoneData.prototype, "lowKey", 0x90);
        defineWord(ZoneData.prototype, "highKey", 0x94);
        defineWord(ZoneData.prototype, "lowVel", 0x9c);
        defineWord(ZoneData.prototype, "highVel", 0xa0);
        defineWord(ZoneData.prototype, "octave", 0xa4);
        defineWord(ZoneData.prototype, "transpose", 0xa8);
        defineWord(ZoneData.prototype, "afterTouch", 0xac);
        defineStick(ZoneData.prototype, "stick1X", 0xb4);
        defineStick(ZoneData.prototype, "stick1Y", 0xb8);
        defineStick(ZoneData.prototype, "stick2X", 0xbc);
        defineStick(ZoneData.prototype, "stick2Y", 0xc0);
        defineStick(ZoneData.prototype, "stick3X", 0xc4);
        defineStick(ZoneData.prototype, "stick3Y", 0xc8);
        definePedal(ZoneData.prototype, "pedal1", 0xd0);
        definePedal(ZoneData.prototype, "pedal2", 0xd4);
        definePedal(ZoneData.prototype, "pedal3", 0xd8);
        definePedal(ZoneData.prototype, "pedal4", 0xdc);
        defineEnum(ZoneData.prototype, "curveType", 0x98, ZoneCurveType);
        defineWord(ZoneData.prototype, "fixedVelocity", 0xb0);
    }

    constructor(public data: DataGetter) {
        this.zones = [0, 1, 2, 3].map(i => new ZoneData(this, i));
    }

    zone = 0;
    name!: string;
    zones: ZoneData[];
}

class GroupData {
    static template: number[] = [...string2unicodes("-----------", 11), 0, 0, ...Array(30 * 2).fill(255), 0, 0];

    static {
        type HasDataGetter = { data: DataGetter; };

        function define<K>(caller: HasDataGetter, name: keyof GroupData, offset: number, length: number, decode: (x: number[]) => K, encode: (x: K) => number[]) {
            Object.defineProperty(caller, name, {
                get: function (this: HasDataGetter) { return decode(this.data.getData(offset, length)) },
                set: function (this: HasDataGetter, value: any) { this.data.setData(offset, length, encode(value)); }
            });
        }

        function defineString(caller: HasDataGetter, name: keyof GroupData, offset: number, length: number) {
            define(caller, name, offset, length, unicodes2string, string2unicodes);
        }

        function defineWord(caller: HasDataGetter, name: keyof GroupData, offset: number) {
            define<number>(caller, name, offset, 1, v => v[0], v => [v]);
        }

        function defineEnum(caller: HasDataGetter, name: keyof GroupData, offset: number, enumobj: any) {
            define<string>(caller, name, offset, 1, v => enumobj[v[0]], v => [enumobj[v]]);
        }

        function defineX(caller: HasDataGetter, name: keyof GroupData, offset: number, ...args: string[]) {
            define(caller, name, offset, 1,
                v => (args[v[0]] ?? v[0] - args.length),
                v => [typeof v === "number" ? (v + args.length) : args.indexOf(v)]
            );
        }

        defineString(this.prototype, "name", 0x00, 13);
        define(this.prototype, 'active', 75, 1, n => n[0] == 2, n => [n ? 2 : 0]);
        define(this.prototype, "presets", 15, 60,
            arr => arr.filter((e, i, a) => (i % 2 == 0) && a[i + 1] == 0),
            num => {
                var result: number[] = Array(60);
                result.fill(255);
                num.forEach((n, i) => {
                    result[i * 2] = n;
                    result[(i * 2) + 1] = 0;
                })
                return result;
            });

    }

    constructor(public data: DataGetter) {

    }
    name!: string;
    presets!: number[];
    active!: boolean;
}

//----------------------------------------

type ATOM<N, T> = { name: N, regex: string, decode: (hex: string) => T, encode: (value: T) => string };
type HEX_OR_ATOM = string | ATOM<any, any>;
type ATOM_NAME<T> = T extends ATOM<infer N, infer K> ? N extends string ? N : never : never;
type ATOM_TYPE<T> = T extends ATOM<infer N, infer K> ? K : never;
type ATOM_PROP<A> = { [Q in A as `${ATOM_NAME<Q>}`]: ATOM_TYPE<A> };

function BYTE<N extends string>(name: N): ATOM<N, number> {
    return { 'name': name, regex: "([0-9a-f]{2})", decode: hex2byte, encode: byte2hex };
}

function WORD<N extends string>(name: N): ATOM<N, number> {
    return { 'name': name, regex: "([0-9a-f]{4})", decode: hex2word, encode: word2hex };
}

function WORDS<N extends string>(name: N, size: number = 0): ATOM<N, number[]> {
    return size ?
        { 'name': name, regex: `([0-9a-f]{${4 * size}})`, decode: hex2array, encode: a => array2hex(a, size) } :
        { 'name': name, regex: `([0-9a-f]{4,})`, decode: hex2array, encode: array2hex };
}

function ASCII<N extends string>(name: N, size: number): ATOM<N, string> {
    return { 'name': name, regex: `([0-9a-f]{${2 * size}})`, decode: hex2ascii, encode: a => ascii2hex(a, size) };
}

function UNICODE<N extends string>(name: N, size: number): ATOM<N, string> {
    return { 'name': name, regex: `([0-9a-f]{${4 * size}})`, decode: hex2unicode, encode: a => unicode2hex(a, size) };
}

function IGNORE(): ATOM<void, void> {
    return { regex: `[0-9a-f]*` } as any;
}

function CreateMatcher<A extends HEX_OR_ATOM, B extends HEX_OR_ATOM, C extends HEX_OR_ATOM, D extends HEX_OR_ATOM, E extends HEX_OR_ATOM>
    (a: A, b: B, c?: C, d?: D, e?: E) {
    type PARAMS = ATOM_PROP<A> & ATOM_PROP<B> & ATOM_PROP<C> & ATOM_PROP<D> & ATOM_PROP<E>;

    const hasRegex = (a: any): a is { regex: string } => typeof a === 'object' && 'regex' in a;
    const isAtom = (a: any): a is ATOM<any, any> => hasRegex(a) && 'name' in a && 'regex' in a && 'encode' in a && 'decode' in a;

    var params = [a, b, c, d, e].filter(e => typeof e !== 'undefined');
    const regex = new RegExp(params.map(p => hasRegex(p) ? p.regex : p ?? "").join(), "gi");

    return new class {
        decode(hex: string): PARAMS {
            const match = hex.match(regex);
            if (!match)
                return undefined as any;
            var result = new Dict<any>();
            var i = 1;
            for (let r of params) {
                if (isAtom(r) && r.name && r.decode)
                    result[r.name] = r.decode(match[i++]);
            }
            return result as PARAMS;
        }

        encode(parms: PARAMS): string {
            return params.map(p => isAtom(p) ? p.encode(parms[p.name as keyof PARAMS]) : typeof p === "string" ? p : "").join();
        }
    }
}


///---------------------------------------
//TODO: Build an API which allows commands to be send
function buildArrayDataGetter(data: number[]): DataGetter {
    return {
        getData(offset: number, length: number): number[] {
            return data.slice(offset, offset + length);
        },
        setData(offset: number, length: number, value: number[]): void {
            for (let i = 0; i < length; i++)
                data[offset + i] = (i < value.length) ? value[i] : 0;
        }
    }
}

// var liveData = {
//     getData: (word_offset: number, word_length: number): number[] => {
//         return lastPatch.slice(word_offset, word_offset + word_length);
//     },
//     setData: (word_offset: number, word_length: number, value: number[]): void => {
//         for (let i = 0; i < word_length; i++)
//             lastPatch[word_offset + i] = (i < value.length) ? value[i] : 0;

//         var r = word2hex(word_offset) + byte2hex(word_length) + value.map(word2hex).join("");
//         println('sending ' + r);
//         var sx = `f000201a0002${r}f7`;
//         sl88.send(sx);
//     }
// };
// var ram = new PatchData(liveData);


class SL88API {

    device: DeviceSysex;

    constructor(midi: MidiPair) {
        var dev = this.device = new DeviceSysex(midi, "00201a00", "");
    }

    PatchIn = CreateMatcher("01", BYTE('patchNo'), "0002", WORDS('patchData', 128), IGNORE());
    PatchParam = CreateMatcher("02", WORD('offset'), BYTE('length'), WORDS('data'));

    async loadPatch(patchNo: number = 16383) {
        var r = await this.device.requestObjectAsync("06" + word2hex(patchNo), this.PatchIn.decode);
        var patch = r.patchData;
        var getter = {
            getData: (word_offset: number, word_length: number): number[] => {
                return patch.slice(word_offset, word_offset + word_length);
            },
            setData: (word_offset: number, word_length: number, value: number[]): void => {
                for (let i = 0; i < word_length; i++)
                    patch[word_offset + i] = (i < value.length) ? value[i] : 0;
                if (patchNo == 16383) {
                    const payload = this.PatchParam.encode({'offset': word_offset, 'length' : word_length, 'data' : value})
                    this.device.send(payload)
                }
            }
        };
        return new PatchData(getter);
    }
}


/*
  .add("InitiateConnection", "00-05-00", () => { })
  .add("InitiateConnectionReply", "05-001100", () => { })

  .add("CheckAttached_", "007f", () => { })
  .add("ConfirmAttached_", "7f", () => { })
  .add("EndOfDump", "000a", () => { })

  //.add("CurrentPatchName", "0a0000-s15", (name: string) => { })
  .add("RequestPatchNameDump", "0010", () => { })
  .add("PatchName", "0a-w-s15", (patch: number, name: string) => { })
  .add("SetPatchParam", "02-w-n-#", (offset: number, length: number, data: number[]) => { })

  .add("SetGlobalTranspose", "05-01-n", (value: number) => { })
  .add("SetGlobalPedalMode", "05-02-n", (value: number) => { })
  .add("SetGlobalCommonChannel", "05-03-n", (value: number) => { })

  .add("SetGlobal", "05-n-n", (param: number, value: number) => { })
  .add("MaybeSessionPreamble", "05-w", (someValue: number) => { }) // 010c-0200-0300
  .add("SelectPatch", "06-w", (patch: number) => { })
  .add("SetMode2", "08-n-w-w", (param: number, val1: number, val2: number) => { })
  .add("SetMode", "08-n-n", (param: number, value: number) => { })
  .add("SetMode3", "08-01-00-58-x85", () => { })
  .add("HandShake", "10", () => { })
  // 0700(CURVE#)(0000=FACTORY,5500=USER)(UNICODE NAME)0000000001000100(30 x little endian maybe curve values 0 usually x7f01/255)0000(127 x little endian velocity values)(two digits)
  .add("Curve_", "0700-x173", (curveNo: number, type: VelocityCurveType, name: string, unk: number, points: number[], velocities: number[], trailer: number) => { })
  .add("GetVelocityCurve_", "0700-n-w-u17-0000-0000-0100-w-x30-0000-x127-n", (curveNo: number, type: VelocityCurveType, name: string, unk: number, points: number[], velocities: number[], trailer: number) => { })
  .add("SetVelocityCurve_", "0701-n-w-u17-0000-0000-0100-w-x30-0000-x127", (curveNo: number, type: VelocityCurveType, name: string, unk: number, points: number[], velocities: number[]) => { })
  .add("SaveToLocation", "09-w", (patch: number) => { })

  .add("BeginDumpIn", "0011", () => { })
  .add("PatchDumpIn", "01-w-0002-x256-n", (patch: number, patchData: number[], checksum: number) => { })
  .add("PatchDumpOut", "01-w-x256", (patch: number, patchData: number[]) => { })
  .add("GroupDumpIn", "03-n-5500-x76-*", (groupNo: number, data: number[]) => { })
  .add("EndOfDumpIn", "11", () => { })

  .add("GroupOrderIn", "04-5500-0000-x12-17", (groupIndices: number[]) => { })
  .add("GroupOrderOut", "04-5500-0000-x12", (groupIndices: number[]) => { })
*/