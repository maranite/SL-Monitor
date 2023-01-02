class MidiChannelProcessor {
    channel: number;
    lastCC: number[] = new Array(128).map((_) => 0);
  
    constructor(channel: number) {
      this.channel = channel;
    }
  
    onMidi(status: number, data1: number, data2: number) {
      status &= 0xf0;
      switch (status) {
        case 0x80:
          this.noteOff(data1, data2);
          break;
  
        case 0x90:
          if (data2 == 0) this.noteOff(data1, data2);
          else this.noteOn(data1, data2);
          break;
  
        case 0xa0:
          this.KeyPressure(data1, data2);
          break;
  
        case 0xb0: // ChannelController
          this.ChannelController(data1, data2);
          this.lastCC[data1] = data2;
          break;
  
        case 0xc0:
          this.ProgramChange(data1, this.lastCC[0], this.lastCC[32]);
          break;
  
        case 0xd0:
          this.ChannelPressure(data1);
          break;
  
        case 0xe0:
          this.PitchBend((data2 << 7) | data1);
          break;
      }
    }
  
    noteOn(key: number, velocity: number) {}
    noteOff(key: number, velocity: number) {}
    KeyPressure(key: number, pressure: number) {}
    ChannelController(cc: number, value: number) {}
    ProgramChange(program: number, bank_msb: number, bank_lsb: number) {}
    ChannelPressure(pressure: number) {}
    PitchBend(bend: number) {}
  }
  
  class MidiProcessor {
    channels: MidiChannelProcessor[];
  
    constructor(port : number) {
      this.onMidi = this.onMidi.bind(this);
      this.channels = new Array(16).map((i) => this.buildChannel(i));
  
      this.channels[0].noteOff = (d: number) => {};
    }
  
    buildChannel = (channel: number) => new MidiChannelProcessor(channel);
  
    onMidi(status: number, data1: number, data2: number) {
      if (status <= 0xf0)
        this.channels[status & 0x0f]?.onMidi(status, data1, data2);
      else {
        switch (status) {
          case 0xf1:
            break; // MTCQuarterFrame
          case 0xf2:
            break; // SongPositionPointer
          case 0xf3:
            break; // SongSelect
          case 0xf6:
            break; // TuneRequest
          case 0xf8:
            break; // TimingClock
          case 0xfa:
            break; // MIDIStart
          case 0xfb:
            break; // MIDIContinue
          case 0xfc:
            break; // MIDIStop
          case 0xfe:
            break; // ActiveSensing
          case 0xff:
            break; // SystemReset
        }
      }
    }
  }
  