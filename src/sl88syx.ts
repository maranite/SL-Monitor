namespace SL {

    export class SLDevice extends DeviceSysex {
        constructor(midi: MidiPair) { super(midi, "00201a00", ""); }
    }

    type codec = [rx: string, decode: (hex: string) => any, encode: (data: any) => string];
    function custom<T>(decode: (hex: string) => T, encode: (value: T) => string, length: number = 2): codec {
        return [`([0-9a-f]{${2 * length}})`, hex2array, array2hex]
    }
    const raw = (length: number): codec => [`([0-9a-f]{${4 * length}})`, s => s, s => s];
    const byte: codec = [`([0-9a-f]{2})`, hex2byte, byte2hex];
    const word: codec = [`([0-9a-f]{4})`, hex2word, word2hex];
    const ascii = (length: number): codec => [`([0-9a-f]{${2 * length}})`, hex2ascii, s => ascii2hex(s, length)];
    const unicode = (length: number): codec => [`([0-9a-f]{${4 * length}})`, hex2unicode, s => unicode2hex(s, length)];
    const words = (length: number = 0): codec => length ?
        [`([0-9a-f]{${4 * length}})`, hex2array, s => array2hex(s, length)] :
        [`([0-9a-f]+)`, hex2array, array2hex];

    const bool = (on: string = "5500", off: string = "0000"): codec => [
        `(${on}|${off})`,
        hex => (hex == on ? true : hex == off ? false : undefined),
        val => val ? on : off];



    const preset_indices: codec = [
        `([0-9a-f]{240})`,
        hex => hex2array(hex).filter((e, i, a) => (i % 2 == 0) && a[i + 1] == 0),
        num => num.map((n: number) => word2hex(n) + "0000").join("").padEnd(240, "7f017f01")
    ];

    const patch_codec: codec = [`([0-9a-f]{${4 * 256}})`, hex => new Patch(hex2array(hex)), (p: Patch) => array2hex(p.data, 256)];

    function choice<T extends { [s: string]: number }>(instance: T, length: 1 | 2 = 2): codec {
        var c = length === 2 ? word : byte;
        var map: { [hex: string]: keyof T } = {};
        Object.entries(instance).forEach(([k, v]) => map[c[2](v)] = k);
        const decode = (hex: string) => map[hex] ?? c[2](hex);
        const encode = (value: keyof T) => c[2](instance[value])
        return [c[0], decode, encode];
    }

    function getArgs(func: Function) {
        return func.toString().match(/function [^(]+\(([^)]*)\)/)![1].split(", ").map(s => s.trim()).filter(s => s);
    }

    /** List of all SYSEX handlers which try_decode() could return */
    export const all_decoders: ((hex: string) => any)[] = [];

    /** Attempts to decode a sysex message and return an instance of the corresponding SYSEX class */
    export function try_decode(hex: string) {
        for (let decode of all_decoders) {
            var result = decode(hex);
            if (result)
                return result;
        }
    }

    /** Registers a POJO and associates it with a SYSEX message format */
    function register<
        Y extends Base,
        T extends new (...args: any[]) => Y,
        ENC = T extends new (...args: infer P) => any ? (...args: P) => string : never
    >
        (target: T, ...args: (string | codec)[]) {

        const regx = new RegExp("^" + args.map(a => typeof a === 'string' ? a : a[0]).join("") + "$", "i");
        const pnames = getArgs(target);
        const codecs: codec[] = args.filter(a => typeof a !== 'string') as codec[];
        target.prototype.toHex = function (this: any) {
            const r = pnames.slice(0);
            return args.map((a, i) => typeof a === 'string' ? a : a[2](this[r.shift()!])).join("");
        }
        if (target.prototype.toString === Base.prototype.toString)
            target.prototype.toString = function (this: any) {
                return `${target.name} ${pnames.map(p => `${p}=${this[p]}`).join(", ")}`;
            }

        const encode = (...args2: any[]) => {
            return args.map(a => typeof a === 'string' ? a : a[2](args2.shift())).join("");
        };

        const decode = (hex: string) => {
            var match = hex.match(regx);
            if (match) {
                if (!pnames.length)
                    return new target();
                try {
                    const rest = match.slice(1).map((r, i) => codecs[i][1](r));
                    // println(JSON.stringify(rest));
                    return new target(...rest);
                } catch (e) {
                    println(`problem with ${target.name}: ${e}`);
                    println(`hex is ${hex};`);
                    const [_, ...rest] = match;
                    rest.forEach((r, i) => println(`match ${i} is ${r}`))
                }
            }
        }

        all_decoders.push(decode);
        return [encode, decode] as [ENC, (hex: string) => InstanceType<T>];
    }


    class DataGetter {
        constructor(public data: number[], public device?: SLDevice) { }

        getData(offset: number, length: number): number[] {
            return this.data.slice(offset, offset + length);
        }
        setData(offset: number, length: number, value: number[]): void {
            for (let i = 0; i < length; i++)
                this.data[offset + i] = (i < value.length) ? value[i] : 0;
            this.device?.send(SL.patchParamHex(offset, length, value));
        }
    }

    const VelocityCurveTypeMap = {
        Factory: 0,
        User: 0x55
    };
    export type VelocityCurveType = keyof typeof VelocityCurveTypeMap

    const ZoneModeMap = {
        Disabled: 0,
        Off: 1,
        On: 2
    }

    const ZoneMidiPortMap = {
        USB: 0,
        Midi1: 1,
        Midi2: 2,
        BT: 3
    };

    const ZoneCurveType2 = {
        // BIT PATTERN:       A B CCC DD
        //   A = (0x80|0x00) 0 = any, 1 = fixed velocity
        //   B = (0x00|0x40) 0 = factory curve, 1= User curve
        //  CC = (0-6)  Selected user curve
        //  DD = (0-3)  Linear / Hill / Ramp     selected
        Linear: 0x0,
        HillCurve: 0x01,
        RampCurve: 0x02,
        Fixed: 0x80,
        // UserMode: 0x40,
        User1: 0x40,
        User2: 0x44,
        User3: 0x48,
        User4: 0x4c,
        User5: 0x50,
        User6: 0x54
    }

    const StickAssign: { [x in ('off' | 'pitchbend' | 'aftertouch' | Exclude<keyof typeof midiCC, 'bankSelect'>)]: number } = {
        off: 0,
        pitchbend: 1,
        aftertouch: 2
    } as any;


    const PedalAssign: { [x in ('off' | 'pitchbend' | Exclude<keyof typeof midiCC, 'bankSelect'>)]: number } = {
        off: 0,
        aftertouch: 1
    } as any;

    Object.entries(midiCC).forEach(([k, v]) => v > 0 && (StickAssign[k as keyof typeof StickAssign] = v + 2));
    Object.entries(midiCC).forEach(([k, v]) => v > 0 && (PedalAssign[k as keyof typeof PedalAssign] = v + 1));

    function choiceKey<T extends { [s: string]: number }>(instance: T, value: number): keyof T {
        for (let [k, v] of Object.entries(instance))
            if (v == value)
                return k;
        return value as keyof T;
    }

    export class Zone {
        constructor(public patch: Patch, public zone: number) { }

        sound!: string;
        instrument!: string;
        enabled!: keyof typeof ZoneModeMap;
        midiPort!: keyof typeof ZoneMidiPortMap;
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
        stick1X!: keyof typeof StickAssign;
        stick1Y!: keyof typeof StickAssign;
        stick2X!: keyof typeof StickAssign;
        stick2Y!: keyof typeof StickAssign;
        stick3X!: keyof typeof StickAssign;
        stick3Y!: keyof typeof StickAssign;
        pedal1!: keyof typeof PedalAssign;
        pedal2!: keyof typeof PedalAssign;
        pedal3!: keyof typeof PedalAssign;
        pedal4!: keyof typeof PedalAssign;
        curveType!: keyof typeof ZoneCurveType2;
        fixedVelocity!: number;

        toString() {
            return `Zone ${this.zone + 1} (${this.enabled}) : ${this.instrument} - ${this.sound}. Program [${this.programChange}, ${this.MSB}, ${this.LSB}]`;
        }
    };

    export type numberOrOff = 'Off' | number

    export class Patch {
        static template: number[] = [85, 83, 76, 32, 56, 56, 32, 71, 82, 65, 78, 68, 0, 32, 32, 32, 0, 0, 0, 0, 0, 0, 0, 0, 73, 78, 83, 84, 82, 85, 77, 69, 78, 84, 0, 32, 73, 78, 83, 84, 82, 85, 77, 69, 78, 84, 0, 32, 73, 78, 83, 84, 82, 85, 77, 69, 78, 84, 0, 32, 73, 78, 83, 84, 82, 85, 77, 69, 78, 84, 0, 32, 83, 79, 85, 78, 68, 0, 32, 32, 32, 32, 32, 83, 79, 85, 78, 68, 0, 32, 32, 32, 32, 32, 83, 79, 85, 78, 68, 0, 32, 32, 32, 32, 32, 83, 79, 85, 78, 68, 0, 32, 32, 32, 32, 32, 2, 2, 2, 2, 0, 0, 1, 2, 0, 1, 0, 1, 127, 127, 127, 127, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 21, 21, 21, 21, 108, 108, 108, 108, 0, 0, 0, 0, 127, 127, 127, 127, 1, 1, 1, 1, 3, 3, 3, 3, 12, 12, 12, 12, 1, 1, 1, 1, 100, 100, 100, 100, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 75, 75, 75, 75, 72, 72, 72, 72, 0, 0, 0, 0, 65, 65, 65, 65, 68, 68, 68, 68, 12, 12, 12, 12, 12, 12, 12, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

        static propertyMap: Dict<string> = {};
        static propertyDecoder: { [offset: number]: (values: number[]) => string } = {};

        private getData(offset: number, length: number): number[] {
            return this.data.slice(offset, offset + length);
        }

        private setData(offset: number, length: number, value: number[]): void {
            for (let i = 0; i < length; i++)
                this.data[offset + i] = (i < value.length) ? value[i] : 0;
            this.device?.send(patchParamHex(offset, length, value));
        }

        static {
            Patch.propertyMap[0x01] = 'name';
            Patch.propertyDecoder[0x01] = (v) => unicodes2string(v);
            Object.defineProperty(this.prototype, 'name', {
                get: function (this: Patch) { return unicodes2string(this.getData(0x01, 0xe)) },
                set: function (this: Patch, value: any) { this.setData(0x01, 0xe, string2unicodes(value, 0x0e)); }
            });

            function define<K>(name: keyof Zone, offset: number, length: number, decode: (x: number[]) => K, encode: (x: K) => number[]) {
                [0, 1, 2, 3].forEach(i => {
                    Patch.propertyMap[offset + (i * length)] = `zone ${1 + i}.${name}`;
                    Patch.propertyDecoder[offset + (i * length)] = v => String(decode(v));
                });

                Object.defineProperty(Zone.prototype, name, {
                    get: function (this: Zone) { return decode(this.patch.getData(offset + (this.zone * length), length)) },
                    set: function (this: Zone, value: any) { this.patch.setData(offset + (this.zone * length), length, encode(value)); }
                });
            }

            function unicode(name: keyof Zone, offset: number, length: number) {
                define(name, offset, length, unicodes2string, s => string2unicodes(s, length));
            }

            function word(name: keyof Zone, offset: number, shift : number = 0, min : number= 0, max : number= 127) {
                define(name, offset, 1, v => v[0] - shift, v => {
                    const r = v + shift;
                    return [r > max ? max : r < min ? min : r]
                });
            }

            function wordOrOff(name: keyof Zone, offset: number) {
                define<'Off'|number>(name, offset, 1, v => v[0] === 255 ? 'Off' : v[0], v => typeof v === 'number' ? [v] : [255]);
            }

            function choiceOf<T extends { [s: string]: number }>(name: keyof Zone, offset: number, instance: T) {
                define(name, offset, 1, v => choiceKey(instance, v[0]), v => [instance[v]]);
            }

            unicode("instrument", 0x18, 0xc);
            unicode("sound", 0x48, 0xb);
            choiceOf("enabled", 0x74, ZoneModeMap);
            word("midiChannel", 0x7c);
            choiceOf("midiPort", 0x78, ZoneMidiPortMap);
            wordOrOff("volume", 0x80);
            wordOrOff("programChange", 0x84);
            wordOrOff("MSB", 0x88);
            wordOrOff("LSB", 0x8c);
            word("lowKey", 0x90);
            word("highKey", 0x94);
            word("lowVel", 0x9c);
            word("highVel", 0xa0);
            word("octave", 0xa4, 3, -3, 3);
            word("transpose", 0xa8, 12, -12, 12);
            word("afterTouch", 0xac);
            choiceOf("stick1X", 0xb4, StickAssign);
            choiceOf("stick1Y", 0xb8, StickAssign);
            choiceOf("stick2X", 0xbc, StickAssign);
            choiceOf("stick2Y", 0xc0, StickAssign);
            choiceOf("stick3X", 0xc4, StickAssign);
            choiceOf("stick3Y", 0xc8, StickAssign);
            choiceOf("pedal1", 0xd0, PedalAssign);
            choiceOf("pedal2", 0xd4, PedalAssign);
            choiceOf("pedal3", 0xd8, PedalAssign);
            choiceOf("pedal4", 0xdc, PedalAssign);
            // choiceOf("curveType", 0x98, ZoneCurveType2);
            word("fixedVelocity", 0xb0);

            define("curveType", 0x98, 1,
                vals => {
                    var v = vals[0];
                    if (v & 0x80) v &= 0x80;
                    else if (v & 0x40) v &= 0x5c;
                    else v &= 3;
                    return choiceKey(ZoneCurveType2, v);
                },
                x => [ZoneCurveType2[x]]);
        }

        constructor(public data: number[], public device?: SysexBase) {
            this.zones = [0, 1, 2, 3].map(i => new Zone(this, i));
            this.getter = new DataGetter(data);
        }

        getter: DataGetter;
        name!: string;
        zones: Zone[];

        toString() {
            return [`Patch: ${this.name}: `, ...this.zones.filter(z => z.enabled !== 'Disabled').map(z => z.toString())].join("\r\n");
        }
    }

    export class PatchSet {
        static template: number[] = [...string2unicodes("-----------", 11), 0, 0, ...Array(30 * 2).fill(255), 0, 0];

        static {
            function define<K>(name: keyof PatchSet, offset: number, length: number, decode: (x: number[]) => K, encode: (x: K) => number[]) {
                Object.defineProperty(PatchSet.prototype, name, {
                    get: function (this: PatchSet) { return decode(this.getter.getData(offset, length)) },
                    set: function (this: PatchSet, value: any) { this.getter.setData(offset, length, encode(value)); }
                });
            }

            define("name", 0x00, 13, unicodes2string, string2unicodes);
            define("presets", 15, 60,
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
            define('active', 75, 1, n => n[0] == 2, n => [n ? 2 : 0]);
        }


        constructor(public data: number[],) {
            this.getter = new DataGetter(data);
        }

        getter: DataGetter;
        name!: string;
        presets!: number[];
        active!: boolean;
    }

    class Base {
        toHex() { return ""; }
        toString() { return ""; }
    }

    export class PatchIn extends Base { constructor(public patchNo: number, public patch: Patch, public checksum: number) { super() } }
    export const [patchInHex, toPatchIn] = register(PatchIn, "01", word, "0002", patch_codec, byte);

    export class PatchOut extends Base { constructor(public patchNo: number, public patch: Patch) { super() } };
    export const [patchOutHex, toPatchOut] = register(PatchOut, "01", word, patch_codec);

    export class PatchParam extends Base {
        constructor(public offset: number, public length: number, public data: number[]) { super() }
        toString() {
            return Patch.propertyMap[this.offset] + ' = ' + Patch.propertyDecoder[this.offset]?.call(null, this.data);
        }
    };
    export const [patchParamHex, toPatchParam] = register(PatchParam, "02", word, byte, words());

    export class RecallPatch extends Base { constructor(public patchNo: number) { super() } };
    export const [recallPatchHex, toRecallPatch] = register(RecallPatch, "06", word);

    export class StorePatch extends Base { constructor(public patchNo: number) { super() } };
    export const [storePatchHex, toStorePatch] = register(StorePatch, "09", word);

    export class PatchName extends Base { constructor(public patchNo: number, public name: string) { super() } };
    export const [patchNameHex, toPatchName] = register(PatchName, "0a", word, ascii(15));

    export class SetMode2 extends Base { constructor(public param: number, public value1: number) { super() } };
    export const [setMode2Hex, toSetMode2] = register(SetMode2, "08", byte, byte);

    export class SetWhiteBlackBalance extends Base {
        constructor(/** 3706 - 4505 */ public white_keys: number, /**3687 - 4506 */ public black_keys: number) { super() }
    };
    export const [setWhiteBlackBalanceHex, toWhiteBlackBalance] = register(SetWhiteBlackBalance, "0800", word, word);

    export class SetKeyBalance extends Base {
        constructor(/** 0-87 */ public key: number, /** 2867 (+30%) to 5326 (-30%)*/ public balance: number) { super() }
    };
    export const [setKeyBalanceHex, toKeyBalance] = register(SetKeyBalance, "0801", byte, "01", word);

    export class SetKeyBalances extends Base {
        constructor(/** key number 0 - 88  */ public first_key: number, /** number of elements in balances */public number_of_keys: number,/** 2867 (+30%) to 5326 (-30%)*/public balances: number[]) { super() }
    };
    export const [setKeyBalancesHex, toSetKeyBalances] = register(SetKeyBalances, "0801", byte, byte, words());

    export class SetGlobalTranspose extends Base { constructor(public value: number) { super() } };
    export const [setGlobalTransposeHex, toSetGlobalTranspose] = register(SetGlobalTranspose, "0501", byte);

    export class SetGlobalPedalMode extends Base { constructor(public value: number) { super() } };
    export const [setGlobalPedalModeHex, toSetGlobalPedalMode] = register(SetGlobalPedalMode, "0502", byte);

    export class SetGlobalCommonChannel extends Base { constructor(public value: number) { super() } };
    export const [setGlobalCommonChannelHex, toSetGlobalCommonChannel] = register(SetGlobalCommonChannel, "0503", byte);

    export class InitiateConnection extends Base { constructor() { super() } };
    export const [initiateConnectionHex, toInitiateConnection] = register(InitiateConnection, "000500");

    export class InitiateConnectionReply extends Base { constructor() { super() } };
    export const [initiateConnectionReplyHex, toInitiateConnectionReply] = register(InitiateConnectionReply, "05001100");

    export class CheckAttached extends Base { constructor() { super() } };
    export const [checkAttachedHex, toCheckAttached] = register(CheckAttached, "007f");

    export class ConfirmAttached extends Base { constructor() { super() } };
    export const [confirmAttachedHex, toConfirmAttached] = register(ConfirmAttached, "7f");

    export class EndOfDump extends Base { constructor() { super() } };
    export const [endOfDumpHex, toEndOfDump] = register(EndOfDump, "000a");

    export class RequestPatchNameDump extends Base { constructor() { super() } };
    export const [requestPatchNameDumpHex, toRequestPatchNameDump] = register(RequestPatchNameDump, "0010");

    export class EndOfPatchNameDump extends Base { constructor() { super() } };
    export const [endOfPatchNameDumpHex, toEndOfPatchNameDump] = register(EndOfPatchNameDump, "10");

    export class BeginDumpIn extends Base { constructor() { super() } };
    export const [beginDumpInHex, toBeginDumpIn] = register(BeginDumpIn, "0011");

    export class EndOfDumpIn extends Base { constructor() { super() } };
    export const [endOfDumpInHex, toEndOfDumpIn] = register(EndOfDumpIn, "11");

    export class SetGlobal extends Base { constructor(public param: number, public value: number) { super() } };
    export const [setGlobalHex, toSetGlobal] = register(SetGlobal, "05", byte, byte);

    export class MaybeSessionPreamble extends Base { constructor(public someValue: number) { super() } };
    export const [maybeSessionPreambleHex, toMaybeSessionPreamble] = register(MaybeSessionPreamble, "05", word);

    export class GroupOrderIn extends Base { constructor(public groupIndices: number[]) { super() } };
    export const [groupOrderInHex, toGroupOrderIn] = register(GroupOrderIn, "0455000000", words(12), "17");

    export class GroupOrderOut extends Base { constructor(public groupIndices: number[]) { super() } };
    export const [groupOrderOutHex, toGroupOrderOut] = register(GroupOrderOut, "0455000000", words(12));

    export class GroupDumpIn extends Base { constructor(public groupNo: number, public name: string, public patchNumbers: number[], public isActive: boolean, public checksum: number) { super() } };
    export const [groupDumpInHex, toGroupDumpIn] = register(GroupDumpIn, "03", byte, "5500", unicode(15), preset_indices, bool("0200"), "0000", byte);

    export class SetGroup extends Base { constructor(public groupNo: number, public name: string, public patchNumbers: number[], public isActive: boolean) { super() } };
    export const [setGroupHex, toSetGroup] = register(SetGroup, "03", byte, "5500", unicode(15), preset_indices, bool("0200", "0000"), "0000");

    export class GetVelocityCurveDump extends Base {
        constructor(
            public curveNo: number,
            public type: VelocityCurveType,
            public name: string,
            public x30IfLast: number,
            public xy_points: number[], // 7f01 (0xff) - off
            public velocities: number[],
            public trailer: number) { super() }
    };
    export const [getVelocityCurveHexDump, toGetVelocityCurveDump] = register(GetVelocityCurveDump,
        "0700",
        byte,
        choice(VelocityCurveTypeMap),
        unicode(10),
        word,
        words(32),
        "0000",
        words(127),
        byte);

    export class GetVelocityCurve extends Base {
        constructor(
            public curveNo: number,
            public type: VelocityCurveType,
            public name: string,
            public x30IfLast: number,
            public xy_points: number[], // 7f01 (0xff) - off
            public velocities: number[]) { super() }
    };
    export const [getVelocityCurveHex, toGetVelocityCurve] = register(GetVelocityCurve,
        "0700",
        byte,
        choice(VelocityCurveTypeMap),
        unicode(10),
        word, //"0000", 
        words(32),
        "0000",
        words(127));

    export class SetVelocityCurve extends Base { constructor(public curveNo: number, public type: VelocityCurveType, public name: string, public unk: number, public points: number[], public velocities: number[]) { super() } };
    export const [setVelocityCurveHex, toSetVelocityCurve] = register(SetVelocityCurve, "0701", byte, choice(VelocityCurveTypeMap), unicode(9), "000000000100", word, words(30), "0000", words(127));
}


class SL88API {

    device: SL.SLDevice;

    constructor(midi: SL.SLDevice | MidiPair) {
        this.device = midi instanceof MidiPair ? new SL.SLDevice(midi) : midi;
    }

    writePatch(patchNo: number, patch: SL.Patch) {
        const hex = SL.patchOutHex(patchNo, patch);
        this.device.send(hex);
    }

    async loadPatch(patchNo: number = 16383) {
        var r = await this.device.requestObjectAsync(SL.recallPatchHex(patchNo), SL.toPatchIn);
        println(`patch received : ${r.patchNo}`);
        println(r.patch.name);
        println(JSON.stringify(r.patch));
        r.patch.device = this.device;       // make it "live" so that changes are recorded to ram
        return r.patch;
    }

    async getPatchNames() {
        println('Getting patch names');
        var results: string[] = [];
        var r = await this.device.requestObjectAsync("0010", SL.try_decode);
        while (true) {
            if (!r) {
                println('unknown: ' + this.device.mostRecentlyReceived);
                break;
            }
            if (r instanceof SL.PatchName) {
                println(`${r.patchNo} - ` + r.toString());
                results[r.patchNo] = r.name;
            }
            else if (r instanceof SL.RecallPatch) {
                println(r.toString());
            }
            else if (r instanceof SL.SetMode2) {
                println(r.toString());
                // println(`setMode2 ${r.param} ${r.value1} ${r.value2}`);
            }
            else if (r instanceof SL.PatchIn) {
                println('Got patch data! :D');
                println(`patch ${r.patchNo} : ${r.patch}`)
            }
            else if (r instanceof SL.GetVelocityCurve) {
                println(r.toString());
            }
            else if (r instanceof SL.SetGlobal) {
                println(r.toString());
            }
            else {
                println(r.toString());
            }
            r = await this.device.awaitReply(SL.try_decode);
        }
        return results;
    }
}