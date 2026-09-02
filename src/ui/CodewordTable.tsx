import { useCopy } from '../copy';
import { useStore } from '../state/store';
import { codewordKey } from '../engine/provenance';
import { toHex } from '../views/Bitstream/Bitstream';
import './codeword-table.css';

/**
 * The matrix's table equivalent (DESIGN.md §8). The matrix itself is already
 * keyboard-navigable module by module with a spoken readout; this is the
 * form that is actually readable — every codeword, its value, its block, and
 * the eight modules carrying it.
 *
 * Rendered only when opened, since at version 15 it is 655 rows.
 */
export function CodewordTable() {
  const { build } = useStore();
  const { t } = useCopy();
  if (!build) return null;

  return (
    <details className="codeword-table">
      <summary className="label">{t('matrix.table')}</summary>
      <p className="label">{t('matrix.tableHint')}</p>
      <div className="codeword-table__scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">{t('tlv.codewords')}</th>
              <th scope="col">{t('matrix.role')}</th>
              <th scope="col">{t('interleave.block')}</th>
              <th scope="col">{t('division.hex')}</th>
              <th scope="col">{t('matrix.coord')}</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(build.dataCodewords, (byte, index) => (
              <Row
                key={`d${index}`}
                index={index}
                kind="data"
                label={t('role.data')}
                byte={byte}
              />
            ))}
            {Array.from(build.eccCodewords, (byte, index) => (
              <Row
                key={`e${index}`}
                index={index}
                kind="ecc"
                label={t('role.ecc')}
                byte={byte}
              />
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function Row({
  index,
  kind,
  label,
  byte,
}: {
  index: number;
  kind: 'data' | 'ecc';
  label: string;
  byte: number;
}) {
  const { build } = useStore();
  const coords = build?.byCodeword.get(codewordKey(kind, index)) ?? [];
  const block =
    coords.length > 0 && build
      ? (() => {
          const [x, y] = coords[0];
          const role = build.modules[y * build.size + x].role;
          return role.kind === 'data' || role.kind === 'ecc' ? role.block : '—';
        })()
      : '—';

  return (
    <tr>
      <th scope="row">{index}</th>
      <td>{label}</td>
      <td>{block}</td>
      <td>{toHex(byte)}</td>
      <td className="codeword-table__coords">
        {coords.map(([x, y]) => `${x},${y}`).join(' ')}
      </td>
    </tr>
  );
}
