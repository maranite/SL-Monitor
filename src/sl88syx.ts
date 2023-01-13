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

    const program_codec: codec = [`([0-9a-f]{${4 * 256}})`, hex => new Program(hex2array(hex)), (p: Program) => array2hex(p.data, 256)];

    function choice<T extends { [s: string]: number }>(instance: T, length: 1 | 2 = 2): codec {
        var c = length === 2 ? word : byte;
        var map: { [hex: string]: keyof T } = {};
        Object.entries(instance).forEach(([k, v]) => map[c[2](v)] = k);
        const decode = (hex: string) => map[hex] ?? c[2](hex);
        const encode = (value: keyof T) => c[2](instance[value])
        return [c[0], decode, encode];
    }

    /** Patches a simply class to behave as a SYSEX message class, with hex, from, toStirng nad toHex methods  */
    function auto<T extends new (...args: any) => any>(target: T, ...args: (string | codec)[]) {
        const regx = new RegExp("^" + args.map(a => typeof a === 'string' ? a : a[0]).join("") + "$", "i");
        const pnames = target.toString().match(/function [^(]+\(([^)]*)\)/)![1].split(", ").map(s => s.trim()).filter(s => s)
        const codecs: codec[] = args.filter(a => typeof a !== 'string') as codec[];
        target.prototype.toHex = function (this: any) {
            const r = pnames.slice(0);
            return args.map((a, i) => typeof a === 'string' ? a : a[2](this[r.shift()!])).join("");
        }
        if (target.prototype.toString === Object.prototype.toString)
            target.prototype.toString = function (this: any) { return `${target.name} ${pnames.map(p => `${p}=${this[p]}`).join(", ")}`; }

        const t = target as any;
        t.hex = (...args2: any[]) => args.map(a => typeof a === 'string' ? a : a[2](args2.shift())).join("");
        t.from = (hex: string) => {
            var match = hex.match(regx);
            if (match) {
                if (!pnames.length)
                    return new target();
                return new target(...match.slice(1).map((r, i) => codecs[i][1](r)));
            }
        }
        all_decoders.push(t.from);

        type fixed<T extends new (...args: any) => any> =
            T extends abstract new (...args: infer P) => infer R ?
            new (...args: P) => R & { toString(): string, toHex(): string }
            : never

        return target as unknown as fixed<T> & {
            hex: T extends abstract new (...args: infer P) => any ? (...args: P) => string : never//ConstuctorLike<T, string>
            from: (hex: string) => InstanceType<T>
        };
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

    class DataGetter {
        constructor(public data: number[], public device?: SLDevice) { }

        getData(offset: number, length: number): number[] {
            return this.data.slice(offset, offset + length);
        }
        setData(offset: number, length: number, value: number[]): void {
            for (let i = 0; i < length; i++)
                this.data[offset + i] = (i < value.length) ? value[i] : 0;
            this.device?.send(SL.ProgramParam.hex(offset, length, value));
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
        constructor(public program: Program, public zone: number) { }

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

    export class Program {
        static template: number[] = [85, 83, 76, 32, 56, 56, 32, 71, 82, 65, 78, 68, 0, 32, 32, 32, 0, 0, 0, 0, 0, 0, 0, 0, 73, 78, 83, 84, 82, 85, 77, 69, 78, 84, 0, 32, 73, 78, 83, 84, 82, 85, 77, 69, 78, 84, 0, 32, 73, 78, 83, 84, 82, 85, 77, 69, 78, 84, 0, 32, 73, 78, 83, 84, 82, 85, 77, 69, 78, 84, 0, 32, 83, 79, 85, 78, 68, 0, 32, 32, 32, 32, 32, 83, 79, 85, 78, 68, 0, 32, 32, 32, 32, 32, 83, 79, 85, 78, 68, 0, 32, 32, 32, 32, 32, 83, 79, 85, 78, 68, 0, 32, 32, 32, 32, 32, 2, 2, 2, 2, 0, 0, 1, 2, 0, 1, 0, 1, 127, 127, 127, 127, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 21, 21, 21, 21, 108, 108, 108, 108, 0, 0, 0, 0, 127, 127, 127, 127, 1, 1, 1, 1, 3, 3, 3, 3, 12, 12, 12, 12, 1, 1, 1, 1, 100, 100, 100, 100, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 75, 75, 75, 75, 72, 72, 72, 72, 0, 0, 0, 0, 65, 65, 65, 65, 68, 68, 68, 68, 12, 12, 12, 12, 12, 12, 12, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

        static propertyMap: Dict<string> = {};
        static propertyDecoder: { [offset: number]: (values: number[]) => string } = {};

        private getData(offset: number, length: number): number[] {
            return this.data.slice(offset, offset + length);
        }

        private setData(offset: number, length: number, value: number[]): void {
            for (let i = 0; i < length; i++)
                this.data[offset + i] = (i < value.length) ? value[i] : 0;
            this.device?.send(ProgramParam.hex(offset, length, value));
        }

        static {
            Program.propertyMap[0x01] = 'name';
            Program.propertyDecoder[0x01] = (v) => unicodes2string(v);
            Object.defineProperty(this.prototype, 'name', {
                get: function (this: Program) { return unicodes2string(this.getData(0x01, 0xe)) },
                set: function (this: Program, value: any) { this.setData(0x01, 0xe, string2unicodes(value, 0x0e)); }
            });

            function define<K>(name: keyof Zone, offset: number, length: number, decode: (x: number[]) => K, encode: (x: K) => number[]) {
                [0, 1, 2, 3].forEach(i => {
                    Program.propertyMap[offset + (i * length)] = `zone ${1 + i}.${name}`;
                    Program.propertyDecoder[offset + (i * length)] = v => String(decode(v));
                });

                Object.defineProperty(Zone.prototype, name, {
                    get: function (this: Zone) { return decode(this.program.getData(offset + (this.zone * length), length)) },
                    set: function (this: Zone, value: any) { this.program.setData(offset + (this.zone * length), length, encode(value)); }
                });
            }

            function unicode(name: keyof Zone, offset: number, length: number) {
                define(name, offset, length, unicodes2string, s => string2unicodes(s, length));
            }

            function word(name: keyof Zone, offset: number, shift: number = 0, min: number = 0, max: number = 127) {
                define(name, offset, 1, v => v[0] - shift, v => {
                    const r = v + shift;
                    return [r > max ? max : r < min ? min : r]
                });
            }

            function wordOrOff(name: keyof Zone, offset: number) {
                define<'Off' | number>(name, offset, 1, v => v[0] === 255 ? 'Off' : v[0], v => typeof v === 'number' ? [v] : [255]);
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
            return [`Program: ${this.name}: `, ...this.zones.filter(z => z.enabled !== 'Disabled').map(z => z.toString())].join("\r\n");
        }
    }

    export class ProgramSet {
        static template: number[] = [...string2unicodes("-----------", 11), 0, 0, ...Array(30 * 2).fill(255), 0, 0];

        static {
            function define<K>(name: keyof ProgramSet, offset: number, length: number, decode: (x: number[]) => K, encode: (x: K) => number[]) {
                Object.defineProperty(ProgramSet.prototype, name, {
                    get: function (this: ProgramSet) { return decode(this.getter.getData(offset, length)) },
                    set: function (this: ProgramSet, value: any) { this.getter.setData(offset, length, encode(value)); }
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


    export const ProgramIn = auto(class ProgramIn { constructor(public programNo: number, public program: Program, public checksum: number) { } }, "01", word, "0002", program_codec, byte);
    export const ProgramOut = auto(class ProgramOut { constructor(public programNo: number, public program: Program) { } }, "01", word, program_codec);

    export const ProgramParam = auto(class ProgramParam {
        constructor(public offset: number, public length: number, public data: number[]) { }
        toString = () => Program.propertyMap[this.offset] + ' = ' + Program.propertyDecoder[this.offset]?.call(null, this.data);
    }, "02", word, byte, words());

    export const RecallProgram = auto(class RecallProgram { constructor(public programNo: number) { } }, "06", word);
    export const StoreProgram = auto(class StoreProgram { constructor(public programNo: number) { } }, "09", word);
    export const ProgramName = auto(class ProgramName { constructor(public programNo: number, public name: string) { } }, "0a", word, ascii(15));
    export const SetMode2 = auto(class SetMode2 { constructor(public param: number, public value1: number) { } }, "08", byte, byte);

    export const SetWhiteBlackBalance = auto(class SetWhiteBlackBalance {
        constructor(/** 3706 - 4505 */ public white_keys: number, /**3687 - 4506 */ public black_keys: number) { }
    }, "0800", word, word);

    export const SetKeyBalance = auto(class SetKeyBalance {
        constructor(/** 0-87 */ public key: number, /** 2867 (+30%) to 5326 (-30%)*/ public balance: number) { }
    }, "0801", byte, "01", word);

    export const SetKeyBalances = auto(class SetKeyBalances {
        constructor(/** key number 0 - 88  */ public first_key: number, /** number of elements in balances */public number_of_keys: number,/** 2867 (+30%) to 5326 (-30%)*/public balances: number[]) { }
    }, "0801", byte, byte, words());

    export const SetGlobalTranspose = auto(class SetGlobalTranspose { constructor(public value: number) { } }, "0501", byte);
    export const SetGlobalPedalMode = auto(class SetGlobalPedalMode { constructor(public value: number) { } }, "0502", byte);
    export const SetGlobalCommonChannel = auto(class SetGlobalCommonChannel { constructor(public value: number) { } }, "0503", byte);
    export const InitiateConnection = auto(class InitiateConnection { }, "000500");
    export const InitiateConnectionReply = auto(class InitiateConnectionReply { }, "05001100");
    export const CheckAttached = auto(class CheckAttached { }, "007f");
    export const ConfirmAttached = auto(class ConfirmAttached { }, "7f");
    export const EndOfDump = auto(class EndOfDump { }, "000a");
    export const RequestProgramNameDump = auto(class RequestProgramNameDump { }, "0010");
    export const EndOfProgramNameDump = auto(class EndOfProgramNameDump { }, "10");
    export const BeginDumpIn = auto(class BeginDumpIn { }, "0011");
    export const EndProgramDump = auto(class EndProgramDump { }, "11");
    export const SetSessionMode = auto(class SetSessionMode { constructor(public param: number, public value: number) { } }, "05", byte, byte);
    export const GroupOrderIn = auto(class GroupOrderIn { constructor(public groupIndices: number[]) { } }, "0455000000", words(12), "17");
    export const GroupOrder = auto(class GroupOrder { constructor(public groupIndices: number[]) { } }, "0455000000", words(12));
    export const GroupDumpIn = auto(class GroupDumpIn {
        constructor(public groupNo: number, public name: string, public programNumbers: number[], public isActive: boolean, public checksum: number) { }
    }, "03", byte, "5500", unicode(15), preset_indices, bool("0200"), "0000", byte);

    export const SetGroup = auto(class SetGroup {
        constructor(public groupNo: number, public name: string, public programNumbers: number[], public isActive: boolean) { }
    }, "03", byte, "5500", unicode(15), preset_indices, bool("0200", "0000"), "0000");

    export const GetVelocityCurveDump = auto(class GetVelocityCurveDump {
        constructor(
            public curveNo: number,
            public type: VelocityCurveType,
            public name: string,
            public x30IfLast: number,
            public xy_points: number[], // 7f01 (0xff) - off
            public velocities: number[],
            public trailer: number) { }
    }, "0700", byte, choice(VelocityCurveTypeMap), unicode(10), word, words(32), "0000", words(127), byte);

    export const GetVelocityCurve = auto(class GetVelocityCurve {
        constructor(
            public curveNo: number,
            public type: VelocityCurveType,
            public name: string,
            public x30IfLast: number,
            public xy_points: number[], // 7f01 (0xff) - off
            public velocities: number[]) { }
    }, "0700", byte, choice(VelocityCurveTypeMap), unicode(10), word, words(32), "0000", words(127));

    export const SetVelocityCurve = auto(class SetVelocityCurve {
        constructor(public curveNo: number, public type: VelocityCurveType, public name: string, public unk: number, public points: number[], public velocities: number[]) { }
    }, "0701", byte, choice(VelocityCurveTypeMap), unicode(9), "000000000100", word, words(30), "0000", words(127));
}


class SL88API {

    device: SL.SLDevice;

    constructor(midi: SL.SLDevice | MidiPair) {
        this.device = midi instanceof MidiPair ? new SL.SLDevice(midi) : midi;
    }

    writeProgram(programNo: number, program: SL.Program) {
        const hex = SL.ProgramOut.hex(programNo, program);
        this.device.send(hex);
    }

    async loadProgram(programNo: number = 16383) {
        var r = await this.device.requestObjectAsync(SL.RecallProgram.hex(programNo), SL.ProgramIn.from);
        println(`program received : ${r.programNo}`);
        println(r.program.name);
        println(JSON.stringify(r.program));
        r.program.device = this.device;       // make it "live" so that changes are recorded to ram
        return r.program;
    }

    async getProgramNames() {
        println('Getting program names');
        var results: string[] = [];
        var r = await this.device.requestObjectAsync("0010", SL.try_decode);
        while (true) {
            if (!r) {
                println('unknown: ' + this.device.mostRecentlyReceived);
                break;
            }
            if (r instanceof SL.ProgramName) {
                println(`${r.programNo} - ` + r.toString());
                results[r.programNo] = r.name;
            }
            else if (r instanceof SL.RecallProgram) {
                println(r.toString());
            }
            else if (r instanceof SL.SetMode2) {
                println(r.toString());
                // println(`setMode2 ${r.param} ${r.value1} ${r.value2}`);
            }
            else if (r instanceof SL.ProgramIn) {
                println('Got program data! :D');
                println(`program ${r.programNo} : ${r.program}`)
            }
            else if (r instanceof SL.GetVelocityCurve) {
                println(r.toString());
            }
            else if (r instanceof SL.SetSessionMode) {
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