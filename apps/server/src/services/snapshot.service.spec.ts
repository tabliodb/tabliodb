import { BadRequestException } from '@nestjs/common';
import { createStarterDiagramModel, type DiagramModel } from '@tabliodb/schema-core';
import { Permission } from '@tabliodb/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '../database.js';
import { SnapshotService } from './snapshot.service.js';

const auth: AuthContext = {
  user: {
    avatarUrl: null,
    cursorColor: '#58cc02',
    email: 'snapshot@tabliodb.local',
    id: 'user-id',
    name: 'Snapshot User',
  },
};

function createSnapshotRow(options: {
  diagramId?: string;
  id: string;
  model?: DiagramModel;
  restoredFromSnapshotId?: string | null;
  version: number;
}) {
  return {
    createdAt: new Date('2026-08-01T08:00:00.000Z'),
    diagramId: options.diagramId ?? 'diagram-id',
    id: options.id,
    message: `Snapshot v${options.version}`,
    restoredFromSnapshotId: options.restoredFromSnapshotId ?? null,
    snapshot: options.model ?? createStarterDiagramModel(),
    version: options.version,
  };
}

describe(SnapshotService.name, () => {
  const diagramService = {
    requireDiagram: vi.fn(),
  };
  const reviewSignalService = {
    syncDiagramModel: vi.fn(),
  };
  const snapshotRepository = {
    create: vi.fn(),
    getByDiagram: vi.fn(),
    getById: vi.fn(),
    restore: vi.fn(),
  };

  let service: SnapshotService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new SnapshotService(diagramService as never, reviewSignalService as never, snapshotRepository as never);
  });

  it('restores an old snapshot by creating a new append-only checkpoint', async () => {
    const sourceSnapshot = createSnapshotRow({ id: 'source-snapshot-id', version: 2 });
    const restoredSnapshot = createSnapshotRow({
      id: 'restored-snapshot-id',
      restoredFromSnapshotId: sourceSnapshot.id,
      version: 5,
    });

    snapshotRepository.getById.mockResolvedValue(sourceSnapshot);
    diagramService.requireDiagram.mockResolvedValue({ id: 'diagram-id' });
    snapshotRepository.restore.mockResolvedValue(restoredSnapshot);

    await expect(service.restore(auth, sourceSnapshot.id)).resolves.toMatchObject({
      id: restoredSnapshot.id,
      restoredFromSnapshotId: sourceSnapshot.id,
      version: 5,
    });
    // Restore perlu permission create snapshot karena aksi ini mempromosikan checkpoint lama menjadi versi aktif baru.
    expect(diagramService.requireDiagram).toHaveBeenCalledWith(auth, 'diagram-id', Permission.SnapshotCreate);
    expect(snapshotRepository.restore).toHaveBeenCalledWith(sourceSnapshot.id, auth.user.id);
    expect(reviewSignalService.syncDiagramModel).toHaveBeenCalledWith('diagram-id', restoredSnapshot.snapshot);
  });

  it('summarizes model changes between two snapshots in the same diagram', async () => {
    const fromModel = createStarterDiagramModel();
    const toModel = {
      ...fromModel,
      tables: {
        ...fromModel.tables,
        users: {
          ...fromModel.tables.users,
          name: 'accounts',
        },
      },
    };
    const fromSnapshot = createSnapshotRow({ id: 'from-snapshot-id', model: fromModel, version: 1 });
    const toSnapshot = createSnapshotRow({ id: 'to-snapshot-id', model: toModel, version: 2 });

    snapshotRepository.getById.mockResolvedValueOnce(fromSnapshot).mockResolvedValueOnce(toSnapshot);
    diagramService.requireDiagram.mockResolvedValue({ id: 'diagram-id' });

    await expect(service.getDiff(auth, fromSnapshot.id, toSnapshot.id)).resolves.toMatchObject({
      dialectChanged: false,
      tables: {
        changed: 0,
        renamed: [{ fromName: 'users', id: 'users', toName: 'accounts' }],
      },
    });
    // Diff adalah read-only, jadi viewer/commenter tetap bisa membandingkan selama punya akses snapshot read.
    expect(diagramService.requireDiagram).toHaveBeenCalledWith(auth, 'diagram-id', Permission.SnapshotRead);
  });

  it('rejects diff requests that compare snapshots from different diagrams', async () => {
    snapshotRepository.getById
      .mockResolvedValueOnce(createSnapshotRow({ diagramId: 'diagram-a-id', id: 'from-snapshot-id', version: 1 }))
      .mockResolvedValueOnce(createSnapshotRow({ diagramId: 'diagram-b-id', id: 'to-snapshot-id', version: 1 }));

    await expect(service.getDiff(auth, 'from-snapshot-id', 'to-snapshot-id')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    // Cross-diagram diff ditolak sebelum permission lookup agar API tidak membocorkan relasi antar snapshot.
    expect(diagramService.requireDiagram).not.toHaveBeenCalled();
  });
});
