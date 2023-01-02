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