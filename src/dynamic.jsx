import React, { Component } from 'react';
import { SimpleBinary } from './binary';
import { hlenBitTable } from './dynamic_constants';
import { HuffmanTree, createTable } from './huffman'
import LogLifecyle from 'react-log-lifecycle';
import { getExtraForLength, getDistanceExtra, getDistanceBase, getLengthBase } from "./static_constants";

export class Dynamic extends Component {
  constructor(props) {
    super(props)
    this.stream = props.stream.copy()
  }

  render() {
    let stream = this.stream
    console.log("Render: ")
    console.log(stream.index())

    const hlit = stream.next(5);
    const hdist = stream.next(5) + 1;
    const hclen = stream.next(4)
    const actualHclen = (hclen + 4)
    const actualHlit = hlit + 257
    const alphabet = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]
    const bitTable = Array(alphabet.length).fill(0)
    for (var i = 0; i < actualHclen; i++) {
      bitTable[alphabet[i]] = stream.next(3)
    }
    // const bitTable = hlenBitTable(stream, actualHclen)
    // now lets read the stream until it's all ready
    //bit table confirmed correct
    const huffmanTable = createTable(bitTable, alphabet)

    const huffmap = {}
    for (var i = 0; i < huffmanTable.length; i++) {
      if (huffmanTable[i] !== 0) {
        huffmap[huffmanTable[i]] = i
      }
    }

    // Get the code lengths for the hlit
    let foundTokens = []
    let runLen = 0
    let last = -1;
    let nextToken = (stream, map) => {
      let start = ""
      let i = 0
      while (map[start] === undefined) {
        i++
        if(i > 100) {
          return 0
        }
        start += ("" + stream.next(1))
      }
      return map[start]
    }

    for (var i = 0; i < actualHlit + hdist;) {
      if (runLen > 0) {
        foundTokens[i] = last
        runLen--
        i++
        continue
      } else {
        let token = nextToken(stream, huffmap)
        if (token === 16) {
          // then we copy the previous code 3-6 times (2 bytes)
          // 0 = 3, 1 = 4, 2 = 5, 3 = 6
          runLen = stream.next(2) + 3
        } else if (token == 17) {
          // then we repeat a value of 0 for 3 bits of length
          runLen = stream.next(3) + 3
          last = 0
        } else if (token == 18) {
          // then we repeat a value of 0 for 7 bits of length
          runLen = stream.next(7) + 11
          last = 0
        } else {
          last = token
          foundTokens[i] = token
          i++
        }
      }
    }

    // Get the huffman for those code lengths
    var compressedAlph = []
    for (var i = 0; i < actualHlit; i++) {
      compressedAlph.push(i)
    }
    var lengthAlph = []
    for (var i = 0; i < hdist; i++) {
      lengthAlph.push(i)
    }

    const litLength = createTable(foundTokens.slice(0, actualHlit), compressedAlph)
    const lenLength = createTable(foundTokens.slice(actualHlit), lengthAlph)
    const litMap = {}
    for (var i = 0; i < litLength.length; i++) {
      if (litLength[i] !== 0) {
        litMap[litLength[i]] = i
      }
    }
    const lenMap = {}
    for (var i = 0; i < lenLength.length; i++) {
      if (lenLength[i] !== 0) {
        lenMap[lenLength[i]] = i
      }
    }

    // now we go and decrypt
    let leggo = []
    for (var i = 0; i < 10000; i++) {
      let dectoken = nextToken(stream, litMap)
      console.log(dectoken)
      if (dectoken < 256) {
        leggo.push(String.fromCharCode(dectoken))
      } else if (dectoken == 256) {
        break;
      } else if (dectoken < 285) {
        // we're going back
        console.log(dectoken)

        const lengthBase = getLengthBase(dectoken)
        const lengthExtra = getExtraForLength(dectoken)
        const lengthExtraValue = stream.next(lengthExtra)

        const backToken = nextToken(stream, lenMap)
        const backExtra = getDistanceExtra(backToken)
        const backBase = getDistanceBase(backToken)
        const backExtraValue = stream.next(backExtra)

        let len = (lengthBase + lengthExtraValue)
        let x = ""
        while (len > 0) {
          len--
          let letter = leggo[leggo.length - backExtraValue - backBase]
          x += letter
          leggo.push(letter)
        }
        console.log("Around" )
        console.log(x)
      }
    }

    return (
      <div>
        <p>
          So this is a dynamic block. To read this we have to first read the huffman
          tables. In a compressed block data is compressed in either
        <ul>
            <li>A literal byte, when the value is between 0, and 255</li>
            <li>
              A length,backwards pair where the length is from 3..258) and distance
              is between 0..32,768.
          </li>
          </ul>
        </p>
        <p>
          The first 5 bits, are HLIT. The number of literal / length codes.
      <SimpleBinary of={hlit} pad={5} />
          we add 257 to this value to get what we're after
      </p>
        <p>
          The next 5 bits are the number of distance codes, aka HDIST
      <SimpleBinary of={hdist} pad={5} />
          We add 257 to Hdist and get {hdist + 257}
        </p>
        <p>
          The last header is the HCLEN which is the number of code lengths, minus 4.
      <SimpleBinary of={hclen} pad={4} />
          After change, this turns into <pre>{actualHclen}</pre>
        </p>
        <p>
          The next part works with HCLEN (example 8) * 3 bits.
        { /* (<Binary of={of} start={start + 14} end={start + 14 + 24} reverse /> */}
        </p>
        <p>
          So this is giving us the lengths of the alphabets for code lenghts. This
          is working with the alphabet: 16, 17, 18,0, 8, 7, 9, 6, 10, 5, 11, 4, 12,
          3, 13, 2, 14, 1, 15.
      </p>
        <p>
          In our example, thie means that
          Now, HLIT + 275 code lengths for the literal/length alphabet. Encoded
          using the code length huffman.
      </p>
        <p>
          {JSON.stringify(bitTable)}
          This makes the huffman tree
          <div className="alphaHuff">
            <HuffmanTree alphabet={[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18]} lens={bitTable} />
          </div>
        </p>
        <p>
          So, now we must read {actualHlit} codes. This is not {actualHlit} bits, but rather codes from the huffman tree
          above. That said, there's a difficult point here. The alphabet of this section is defined as follows:
      </p>
        <pre>{`
                     0 - 15: Represent code lengths of 0 - 15
                     16: Copy the previous code length 3 - 6 times.
                         The next 2 bits indicate repeat length
                               (0 = 3, ... , 3 = 6)
                            Example:  Codes 8, 16 (+2 bits 11),
                                      16 (+2 bits 10) will expand to
                                      12 code lengths of 8 (1 + 6 + 5)
                     17: Repeat a code length of 0 for 3 - 10 times.
                         (3 bits of length)
                     18: Repeat a code length of 0 for 11 - 138 times
                         (7 bits of length)

                      A code length of 0 indicates that the corresponding symbol in
                      the literal/length or distance alphabet will not occur in the
                      block, and should not participate in the Huffman code
                      construction algorithm given earlier.
      `}
        </pre>
        <p>
          Thus you can see that if you read code points 16, 17, or 18, then you'll end up reading more than one. Thanks to this,
          you can't simply read code points without ensuring that you perform the relevant backtracking when necessary.
      </p>
        Here's the codepoints if one was to read
      {foundTokens.join(', ')}
        <p>
          So these correspond to the code lengths found for the alphabet 0 - {actualHlit}. So, now we build up the actual Huffman tree that will
          decompress the actual data. To get the actual lengths though, we have to do some translaction to match
      </p>
        <p>
        </p>
        <div>
          <HuffmanTree alphabet={compressedAlph} lens={foundTokens.slice(0, actualHlit)} />
        </div>
        <p>
          That's not the last huffman we'll see. We still have to get the distance huffman
        </p>
        <HuffmanTree alphabet={lengthAlph} lens={foundTokens.slice(actualHlit)} />
        <p>
          FINALLY. WE have the tools to decode this block. Dear reader, hopefully reading to this section hasn't taken you too
          long, but at this stage i'm a few weeks worth of spare time to get to this part.
        </p>

        <code>
          {leggo.join('')}
        </code>
        <p>
          And we're done!
        </p>
      </div>
    );
  }
}