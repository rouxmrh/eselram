(function (global) {
  "use strict";

  const BLOCKS_L = {"1":[[1,26,19]],"2":[[1,44,34]],"3":[[1,70,55]],"4":[[1,100,80]],"5":[[1,134,108]],"6":[[2,86,68]],"7":[[2,98,78]],"8":[[2,121,97]],"9":[[2,146,116]],"10":[[2,86,68],[2,87,69]],"11":[[4,101,81]],"12":[[2,116,92],[2,117,93]],"13":[[4,133,107]],"14":[[3,145,115],[1,146,116]],"15":[[5,109,87],[1,110,88]],"16":[[5,122,98],[1,123,99]],"17":[[1,135,107],[5,136,108]],"18":[[5,150,120],[1,151,121]],"19":[[3,141,113],[4,142,114]],"20":[[3,135,107],[5,136,108]],"21":[[4,144,116],[4,145,117]],"22":[[2,139,111],[7,140,112]],"23":[[4,151,121],[5,152,122]],"24":[[6,147,117],[4,148,118]],"25":[[8,132,106],[4,133,107]],"26":[[10,142,114],[2,143,115]],"27":[[8,152,122],[4,153,123]],"28":[[3,147,117],[10,148,118]],"29":[[7,146,116],[7,147,117]],"30":[[5,145,115],[10,146,116]],"31":[[13,145,115],[3,146,116]],"32":[[17,145,115]],"33":[[17,145,115],[1,146,116]],"34":[[13,145,115],[6,146,116]],"35":[[12,151,121],[7,152,122]],"36":[[6,151,121],[14,152,122]],"37":[[17,152,122],[4,153,123]],"38":[[4,152,122],[18,153,123]],"39":[[20,147,117],[4,148,118]],"40":[[19,148,118],[6,149,119]]};
  const ALIGN = {"1":[],"2":[6,18],"3":[6,22],"4":[6,26],"5":[6,30],"6":[6,34],"7":[6,22,38],"8":[6,24,42],"9":[6,26,46],"10":[6,28,50],"11":[6,30,54],"12":[6,32,58],"13":[6,34,62],"14":[6,26,46,66],"15":[6,26,48,70],"16":[6,26,50,74],"17":[6,30,54,78],"18":[6,30,56,82],"19":[6,30,58,86],"20":[6,34,62,90],"21":[6,28,50,72,94],"22":[6,26,50,74,98],"23":[6,30,54,78,102],"24":[6,28,54,80,106],"25":[6,32,58,84,110],"26":[6,30,58,86,114],"27":[6,34,62,90,118],"28":[6,26,50,74,98,122],"29":[6,30,54,78,102,126],"30":[6,26,52,78,104,130],"31":[6,30,56,82,108,134],"32":[6,34,60,86,112,138],"33":[6,30,58,86,114,142],"34":[6,34,62,90,118,146],"35":[6,30,54,78,102,126,150],"36":[6,24,50,76,102,128,154],"37":[6,28,54,80,106,132,158],"38":[6,32,58,84,110,136,162],"39":[6,26,54,82,110,138,166],"40":[6,30,58,86,114,142,170]};

  function utf8Bytes(text) {
    return Array.from(
      new TextEncoder().encode(
        String(text || "")
      )
    );
  }

  function bitLength(n) {
    let length = 0;

    while (n > 0) {
      length += 1;
      n >>>= 1;
    }

    return length;
  }

  function bchTypeInfo(data) {
    let value = data << 10;
    const generator = 0x537;

    while (
      bitLength(value) >=
      bitLength(generator)
    ) {
      value ^=
        generator <<
        (
          bitLength(value) -
          bitLength(generator)
        );
    }

    return (
      (
        (data << 10) |
        value
      ) ^
      0x5412
    );
  }

  function bchTypeNumber(data) {
    let value = data << 12;
    const generator = 0x1f25;

    while (
      bitLength(value) >=
      bitLength(generator)
    ) {
      value ^=
        generator <<
        (
          bitLength(value) -
          bitLength(generator)
        );
    }

    return (
      (data << 12) |
      value
    );
  }

  function gfTables() {
    const exp =
      new Array(
        512
      ).fill(0);

    const log =
      new Array(
        256
      ).fill(0);

    let x = 1;

    for (
      let i = 0;
      i < 255;
      i += 1
    ) {
      exp[i] = x;
      log[x] = i;

      x <<= 1;

      if (
        x & 0x100
      ) {
        x ^= 0x11d;
      }
    }

    for (
      let i = 255;
      i < 512;
      i += 1
    ) {
      exp[i] =
        exp[
          i - 255
        ];
    }

    return {
      exp,
      log
    };
  }

  const GF =
    gfTables();

  function gfMul(
    a,
    b
  ) {
    if (
      !a ||
      !b
    ) {
      return 0;
    }

    return GF.exp[
      GF.log[a] +
      GF.log[b]
    ];
  }

  function generatorPolynomial(
    degree
  ) {
    let poly = [1];

    for (
      let i = 0;
      i < degree;
      i += 1
    ) {
      const next =
        new Array(
          poly.length + 1
        ).fill(0);

      for (
        let j = 0;
        j < poly.length;
        j += 1
      ) {
        next[j] ^=
          poly[j];

        next[j + 1] ^=
          gfMul(
            poly[j],
            GF.exp[i]
          );
      }

      poly = next;
    }

    return poly;
  }

  function reedSolomon(
    data,
    eccLength
  ) {
    const generator =
      generatorPolynomial(
        eccLength
      );

    const result =
      new Array(
        data.length +
        eccLength
      ).fill(0);

    for (
      let i = 0;
      i < data.length;
      i += 1
    ) {
      result[i] =
        data[i];
    }

    for (
      let i = 0;
      i < data.length;
      i += 1
    ) {
      const factor =
        result[i];

      if (!factor) {
        continue;
      }

      for (
        let j = 0;
        j < generator.length;
        j += 1
      ) {
        result[i + j] ^=
          gfMul(
            generator[j],
            factor
          );
      }
    }

    return result.slice(
      data.length
    );
  }

  function pushBits(
    target,
    value,
    length
  ) {
    for (
      let i = length - 1;
      i >= 0;
      i -= 1
    ) {
      target.push(
        (
          value >>> i
        ) & 1
      );
    }
  }

  function dataCapacity(
    version
  ) {
    return BLOCKS_L[
      version
    ].reduce(
      (
        total,
        group
      ) =>
        total +
        group[0] *
        group[2],
      0
    );
  }

  function chooseVersion(
    byteLength
  ) {
    for (
      let version = 1;
      version <= 40;
      version += 1
    ) {
      const countBits =
        version <= 9
          ? 8
          : 16;

      const capacityBits =
        dataCapacity(
          version
        ) * 8;

      const requiredBits =
        4 +
        countBits +
        byteLength * 8;

      if (
        requiredBits <=
        capacityBits
      ) {
        return version;
      }
    }

    throw new Error(
      "Payment URL is too long for a standard QR code."
    );
  }

  function createDataCodewords(
    bytes,
    version
  ) {
    const capacity =
      dataCapacity(
        version
      ) * 8;

    const bits = [];

    // Byte mode.
    pushBits(
      bits,
      0b0100,
      4
    );

    pushBits(
      bits,
      bytes.length,
      version <= 9
        ? 8
        : 16
    );

    bytes.forEach(
      (byte) =>
        pushBits(
          bits,
          byte,
          8
        )
    );

    const terminator =
      Math.min(
        4,
        capacity -
        bits.length
      );

    for (
      let i = 0;
      i < terminator;
      i += 1
    ) {
      bits.push(0);
    }

    while (
      bits.length % 8
    ) {
      bits.push(0);
    }

    const words = [];

    for (
      let i = 0;
      i < bits.length;
      i += 8
    ) {
      let word = 0;

      for (
        let j = 0;
        j < 8;
        j += 1
      ) {
        word =
          (
            word << 1
          ) |
          bits[
            i + j
          ];
      }

      words.push(
        word
      );
    }

    const pads = [
      0xec,
      0x11
    ];

    let padIndex = 0;

    while (
      words.length <
      dataCapacity(
        version
      )
    ) {
      words.push(
        pads[
          padIndex % 2
        ]
      );

      padIndex += 1;
    }

    return words;
  }

  function interleaveCodewords(
    dataWords,
    version
  ) {
    const blocks = [];
    let offset = 0;

    BLOCKS_L[
      version
    ].forEach(
      (
        [
          count,
          total,
          data
        ]
      ) => {
        const eccLength =
          total -
          data;

        for (
          let i = 0;
          i < count;
          i += 1
        ) {
          const blockData =
            dataWords.slice(
              offset,
              offset +
              data
            );

          offset += data;

          blocks.push({
            data:
              blockData,
            ecc:
              reedSolomon(
                blockData,
                eccLength
              )
          });
        }
      }
    );

    const result = [];

    const maxData =
      Math.max(
        ...blocks.map(
          (block) =>
            block.data
              .length
        )
      );

    for (
      let i = 0;
      i < maxData;
      i += 1
    ) {
      blocks.forEach(
        (block) => {
          if (
            i <
            block.data
              .length
          ) {
            result.push(
              block.data[i]
            );
          }
        }
      );
    }

    const maxEcc =
      Math.max(
        ...blocks.map(
          (block) =>
            block.ecc
              .length
        )
      );

    for (
      let i = 0;
      i < maxEcc;
      i += 1
    ) {
      blocks.forEach(
        (block) => {
          if (
            i <
            block.ecc
              .length
          ) {
            result.push(
              block.ecc[i]
            );
          }
        }
      );
    }

    return result;
  }

  function createMatrix(
    version
  ) {
    const size =
      17 +
      version * 4;

    const matrix =
      Array.from(
        {
          length:
            size
        },
        () =>
          new Array(
            size
          ).fill(null)
      );

    const reserved =
      Array.from(
        {
          length:
            size
        },
        () =>
          new Array(
            size
          ).fill(false)
      );

    function set(
      row,
      col,
      dark,
      isReserved = true
    ) {
      if (
        row < 0 ||
        col < 0 ||
        row >= size ||
        col >= size
      ) {
        return;
      }

      matrix[row][col] =
        Boolean(
          dark
        );

      if (
        isReserved
      ) {
        reserved[row][col] =
          true;
      }
    }

    function finder(
      top,
      left
    ) {
      for (
        let r = -1;
        r <= 7;
        r += 1
      ) {
        for (
          let c = -1;
          c <= 7;
          c += 1
        ) {
          const row =
            top + r;

          const col =
            left + c;

          const inside =
            r >= 0 &&
            r <= 6 &&
            c >= 0 &&
            c <= 6;

          const dark =
            inside &&
            (
              r === 0 ||
              r === 6 ||
              c === 0 ||
              c === 6 ||
              (
                r >= 2 &&
                r <= 4 &&
                c >= 2 &&
                c <= 4
              )
            );

          set(
            row,
            col,
            dark
          );
        }
      }
    }

    finder(
      0,
      0
    );

    finder(
      0,
      size - 7
    );

    finder(
      size - 7,
      0
    );

    for (
      let i = 8;
      i <
        size - 8;
      i += 1
    ) {
      if (
        !reserved[6][i]
      ) {
        set(
          6,
          i,
          i % 2 === 0
        );
      }

      if (
        !reserved[i][6]
      ) {
        set(
          i,
          6,
          i % 2 === 0
        );
      }
    }

    const positions =
      ALIGN[
        version
      ];

    positions.forEach(
      (row) => {
        positions.forEach(
          (col) => {
            const overlaps =
              (
                row <= 8 &&
                col <= 8
              ) ||
              (
                row <= 8 &&
                col >=
                  size - 9
              ) ||
              (
                row >=
                  size - 9 &&
                col <= 8
              );

            if (
              overlaps
            ) {
              return;
            }

            for (
              let dr = -2;
              dr <= 2;
              dr += 1
            ) {
              for (
                let dc = -2;
                dc <= 2;
                dc += 1
              ) {
                const distance =
                  Math.max(
                    Math.abs(dr),
                    Math.abs(dc)
                  );

                set(
                  row + dr,
                  col + dc,
                  distance === 2 ||
                  distance === 0
                );
              }
            }
          }
        );
      }
    );

    const formatA = [
      [8, 0],
      [8, 1],
      [8, 2],
      [8, 3],
      [8, 4],
      [8, 5],
      [8, 7],
      [8, 8],
      [7, 8],
      [5, 8],
      [4, 8],
      [3, 8],
      [2, 8],
      [1, 8],
      [0, 8]
    ];

    const formatB = [
      [size - 1, 8],
      [size - 2, 8],
      [size - 3, 8],
      [size - 4, 8],
      [size - 5, 8],
      [size - 6, 8],
      [size - 7, 8],
      [8, size - 8],
      [8, size - 7],
      [8, size - 6],
      [8, size - 5],
      [8, size - 4],
      [8, size - 3],
      [8, size - 2],
      [8, size - 1]
    ];

    [
      ...formatA,
      ...formatB
    ].forEach(
      ([r, c]) =>
        set(
          r,
          c,
          false
        )
    );

    set(
      size - 8,
      8,
      true
    );

    if (
      version >= 7
    ) {
      const bits =
        bchTypeNumber(
          version
        );

      for (
        let i = 0;
        i < 18;
        i += 1
      ) {
        const dark =
          (
            (
              bits >>> i
            ) &
            1
          ) === 1;

        const row =
          Math.floor(
            i / 3
          );

        const col =
          i % 3 +
          size -
          11;

        set(
          row,
          col,
          dark
        );

        set(
          col,
          row,
          dark
        );
      }
    }

    return {
      size,
      matrix,
      reserved,
      set
    };
  }

  function placeData(
    matrixInfo,
    codewords
  ) {
    const {
      size,
      matrix,
      reserved
    } =
      matrixInfo;

    const bits = [];

    codewords.forEach(
      (word) =>
        pushBits(
          bits,
          word,
          8
        )
    );

    let bitIndex = 0;
    let upward = true;

    for (
      let col =
        size - 1;
      col > 0;
      col -= 2
    ) {
      if (
        col === 6
      ) {
        col -= 1;
      }

      for (
        let step = 0;
        step < size;
        step += 1
      ) {
        const row =
          upward
            ? size -
              1 -
              step
            : step;

        for (
          let offset = 0;
          offset < 2;
          offset += 1
        ) {
          const currentCol =
            col -
            offset;

          if (
            reserved[row][
              currentCol
            ]
          ) {
            continue;
          }

          const rawBit =
            bitIndex <
              bits.length
              ? bits[
                  bitIndex
                ]
              : 0;

          bitIndex += 1;

          const masked =
            rawBit ^
            (
              (
                row +
                currentCol
              ) %
                2 ===
              0
                ? 1
                : 0
            );

          matrix[row][
            currentCol
          ] =
            Boolean(
              masked
            );
        }
      }

      upward =
        !upward;
    }
  }

  function placeFormatInfo(
    matrixInfo
  ) {
    const {
      size,
      set
    } =
      matrixInfo;

    // EC level L = 01, mask pattern 0.
    const format =
      bchTypeInfo(
        0b01000
      );

    const a = [
      [8, 0],
      [8, 1],
      [8, 2],
      [8, 3],
      [8, 4],
      [8, 5],
      [8, 7],
      [8, 8],
      [7, 8],
      [5, 8],
      [4, 8],
      [3, 8],
      [2, 8],
      [1, 8],
      [0, 8]
    ];

    const b = [
      [size - 1, 8],
      [size - 2, 8],
      [size - 3, 8],
      [size - 4, 8],
      [size - 5, 8],
      [size - 6, 8],
      [size - 7, 8],
      [8, size - 8],
      [8, size - 7],
      [8, size - 6],
      [8, size - 5],
      [8, size - 4],
      [8, size - 3],
      [8, size - 2],
      [8, size - 1]
    ];

    for (
      let i = 0;
      i < 15;
      i += 1
    ) {
      const dark =
        (
          (
            format >>> i
          ) &
          1
        ) === 1;

      set(
        a[i][0],
        a[i][1],
        dark
      );

      set(
        b[i][0],
        b[i][1],
        dark
      );
    }

    set(
      size - 8,
      8,
      true
    );
  }

  function encode(
    text
  ) {
    const bytes =
      utf8Bytes(
        text
      );

    const version =
      chooseVersion(
        bytes.length
      );

    const dataWords =
      createDataCodewords(
        bytes,
        version
      );

    const codewords =
      interleaveCodewords(
        dataWords,
        version
      );

    const matrixInfo =
      createMatrix(
        version
      );

    placeData(
      matrixInfo,
      codewords
    );

    placeFormatInfo(
      matrixInfo
    );

    return {
      version,
      size:
        matrixInfo.size,
      modules:
        matrixInfo.matrix
    };
  }

  function toSvg(
    text,
    options = {}
  ) {
    const qr =
      encode(
        text
      );

    const quiet =
      Number.isFinite(
        Number(
          options.quiet
        )
      )
        ? Math.max(
            0,
            Number(
              options.quiet
            )
          )
        : 4;

    const dark =
      options.dark ||
      "#111111";

    const light =
      options.light ||
      "#ffffff";

    const viewSize =
      qr.size +
      quiet * 2;

    const paths = [];

    for (
      let row = 0;
      row < qr.size;
      row += 1
    ) {
      let start = null;

      for (
        let col = 0;
        col <= qr.size;
        col += 1
      ) {
        const on =
          col <
            qr.size &&
          qr.modules[row][col];

        if (
          on &&
          start === null
        ) {
          start = col;
        }

        if (
          !on &&
          start !== null
        ) {
          paths.push(
            `M${
              start +
              quiet
            } ${
              row +
              quiet
            }h${
              col -
              start
            }v1h-${
              col -
              start
            }z`
          );

          start = null;
        }
      }
    }

    return [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewSize} ${viewSize}" shape-rendering="crispEdges">`,
      `<rect width="100%" height="100%" fill="${light}"/>`,
      `<path d="${paths.join("")}" fill="${dark}"/>`,
      "</svg>"
    ].join("");
  }

  function toDataUrl(
    text,
    options = {}
  ) {
    return (
      "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(
        toSvg(
          text,
          options
        )
      )
    );
  }

  global.EselramQr = {
    encode,
    toSvg,
    toDataUrl
  };
})(
  typeof window !==
    "undefined"
    ? window
    : globalThis
);
