
///--------------

function hex2byte(hex: string): number {
  return parseInt(hex.substring(0, 2), 16);
}

function byte2hex(value: number): string {
  return value.toString(16).padStart(2, "0");
}

function hex2word(hex: string): number {
  return (parseInt(hex.substring(2, 4), 16) << 7) + parseInt(hex.substring(0, 2), 16);
}

function word2hex(value: number): string {
  return byte2hex(value & 0x7F) + byte2hex((value >> 7) & 0x7F);
}

function ascii2hex(ascii: string, maxlen?: number) {
  maxlen = maxlen || ascii.length;
  var str = "";
  for (let i = 0; i < maxlen; i++)
    str += (i < ascii.length && i < maxlen - 1) ? byte2hex(ascii.charCodeAt(i)) : "00";
  return str;
}

function hex2ascii(hex: string) {
  var str = '';
  for (var i = 0; (i < hex.length && hex.substring(i, i + 2) !== '00'); i += 2)
    str += String.fromCharCode(parseInt(hex.substring(i, i + 2), 16));
  return str;
}

function unicode2hex(str: string, maxlen?: number) {
  maxlen = maxlen || str.length;
  var str = "";
  for (let i = 0; i < maxlen; i++)
    str += (i < str.length && i < maxlen - 1) ? word2hex(str.charCodeAt(i)) : "0000";
  return str;
}

function hex2unicode(hex: string) {
  var str = '';
  for (var i = 0; i < hex.length; i += 4) {
    const val = hex2word(hex.substring(i, i + 4));
    if (val == 0)
      break;
    str += String.fromCharCode(val);
  }
  return str;
}

function array2hex(values: number[], forceLen?: number) {
  var result = values.map(word2hex).join("");
  if (forceLen && values.length < forceLen)
    result.padEnd(forceLen - values.length, "0000");
  return result;
}

function hex2array(hex: string) : number[] {
  return hex.match(/([0-9a-fA-F]{4})/g)?.map(hex2word) || [];
}


function printSysex(data: string) {
  println("Sysex: " + prettyHex(data));
}

function convertASCIItoHex(asciiVal: string) {
  let asciiCode = asciiVal.charCodeAt(0);
  let hexValue = asciiCode.toString(16);
  console.log("0x" + hexValue);
}

/**
 * Clean-up hex for printing (groups bytes as pairs, upper case).
 * @return {string}
 */
function prettyHex(hex: string) {
  //  hex = hex.replace(" ", "", "g"); // remove spaces
  hex = hex.replace(" ", ""); // remove spaces

  var result = "";
  var first = true;
  for (let i = 0; i < hex.length; i += 2) {
    if (!first)
      result += " ";

    result += hex.substring(i, 2);
    first = false;
  }

  return result.toUpperCase();
}



function string2unicodes(str: string, maxlen?: number): number[] {
  maxlen = maxlen || str.length;
  var r: number[] = Array(maxlen);
  for (let i = 0; i < maxlen; i++)
    r[i] = (i < str.length && i < maxlen - 1) ? str.charCodeAt(i) : 0;
  return r;
}

function unicodes2string(atoms: number[]) {
  var result = "";
  for (let charCode of atoms) {
    if (charCode == 0) break;
    result += String.fromCharCode(charCode);
  }
  return result;
}

const toTitleCase = (str: string) => {
  return str.toLowerCase().split(' ').map(function (word) {
    return word.replace(word[0], word[0].toUpperCase());
  }).join(' ');
}



///---------------------------------------


interface Array<T> {
  add(element: T): () => boolean
}

Array.prototype.add = function (this: Array<any>, element: any) {
  this.push(element);
  return () => {
    var index = this.indexOf(element);
    if (index > -1)
      delete this[index];
    return index > -1;
  };
}

///---------------------------------------


