import { useState } from 'react'
import { Dialog } from '../../ui/Dialog/Dialog'
import { IconButton } from '../../ui/IconButton/IconButton'
import { HostFlags } from './HostFlags'
import { type Choice, ChoiceSelect, Row, Section } from './SettingRows'
import styles from './SettingsPage.module.css'
import { ToolPaths } from './ToolPaths'
import type { useServerInfo } from './useServerInfo'
import type { Theme } from './useTheme'

type Props = {
  theme: Choice<Theme>
  server: ReturnType<typeof useServerInfo>
  /** Finished or skipped. */
  onDone: () => void
}

const STEPS = ['Welcome to gitdeck', 'Programs', 'On this computer'] as const

/** The first-run popup: the choices worth making before the first repository. */
export function SetupDialog({ theme, server, onDone }: Props) {
  const [step, setStep] = useState(0)
  const { info, host } = server
  if (!info || !host) return null
  const last = step === STEPS.length - 1

  return (
    <Dialog
      title={STEPS[step]}
      actions={
        <>
          <span className={styles.stepCount}>
            Step {step + 1} of {STEPS.length}
          </span>
          <IconButton title="Close the setup; everything is in Settings later" onClick={onDone}>
            Skip
          </IconButton>
          {step > 0 && (
            <IconButton title="Previous step" onClick={() => setStep(step - 1)}>
              Back
            </IconButton>
          )}
          <IconButton title={last ? 'Finish the setup' : 'Next step'} onClick={() => (last ? onDone() : setStep(step + 1))}>
            {last ? 'Done' : 'Next'}
          </IconButton>
        </>
      }
    >
      <div className={styles.setup}>
        {step === 0 && (
          <>
            <p className={styles.intro}>gitdeck browses your repositories. A few choices to start with, all of them in Settings later.</p>
            <Row label="Theme">
              <ChoiceSelect choice={theme} />
            </Row>
          </>
        )}
        {step === 1 && (
          <>
            <p className={styles.intro}>Leave a field empty to use the default shown under it.</p>
            <ToolPaths
              git={{ path: info.git, version: info.gitVersion, onSave: server.setGit }}
              editor={{ path: info.editor, onSave: server.setEditor }}
              fileManager={{ path: info.fileManager, detected: info.fileManagerDetected, onSave: server.setFileManager }}
            />
          </>
        )}
        {step === 2 && (
          <>
            <Section title="gitd">
              <HostFlags host={host} />
              <Row label="Keep gitd running when every window is closed">
                <input type="checkbox" checked={info.keepRunning} onChange={(e) => server.setKeepRunning(e.target.checked)} />
              </Row>
            </Section>
            <Section title="GitHub (off: nothing leaves this computer)">
              <Row label="Author pictures from GitHub">
                <input type="checkbox" checked={info.githubAvatars} onChange={(e) => server.setGithubAvatars(e.target.checked)} />
              </Row>
              <Row label="Pull requests, through the host's own gh login">
                <input type="checkbox" checked={info.githubPrs} onChange={(e) => server.setGithubPrs(e.target.checked)} />
              </Row>
            </Section>
          </>
        )}
      </div>
    </Dialog>
  )
}
