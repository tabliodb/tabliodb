import { useMutation } from '@tanstack/react-query';
import {
  activatePreparedSessionBinding,
  completeSetup,
  prepareSessionBinding,
  updateInstanceAuthSettings,
  updateOidcProviderSettings,
  updateSmtpSettings,
  type InstanceAuthSettingsUpdateDto,
  type OidcProviderSettingsUpdateDto,
  type SetupCreateDto,
  type SmtpSettingsUpdateDto,
} from '@tabliodb/sdk';
import { queryClient, type MutationConfig } from '@/lib/react-query';
import { projectsKeys } from '@/resources/projects';
import { setupKeys } from './setup.keys';

const completeSetupMutationFn = async (body: SetupCreateDto) => {
  const sessionBinding = await prepareSessionBinding();

  return completeSetup({
    setupCreateDto: sessionBinding
      ? {
          ...body,
          // First owner session is browser-bound immediately after the instance setup succeeds.
          sessionBinding,
        }
      : body,
  });
};
const updateAuthSettingsMutationFn = (body: InstanceAuthSettingsUpdateDto) =>
  updateInstanceAuthSettings({ instanceAuthSettingsUpdateDto: body });
const updateOidcProviderMutationFn = (body: OidcProviderSettingsUpdateDto) =>
  updateOidcProviderSettings({ oidcProviderSettingsUpdateDto: body });
const updateSmtpSettingsMutationFn = (body: SmtpSettingsUpdateDto) =>
  updateSmtpSettings({ smtpSettingsUpdateDto: body });

type UseCompleteSetupMutationParams = {
  mutationConfig?: MutationConfig<typeof completeSetupMutationFn>;
};
type UseUpdateAuthSettingsMutationParams = {
  mutationConfig?: MutationConfig<typeof updateAuthSettingsMutationFn>;
};
type UseUpdateOidcProviderMutationParams = {
  mutationConfig?: MutationConfig<typeof updateOidcProviderMutationFn>;
};
type UseUpdateSmtpSettingsMutationParams = {
  mutationConfig?: MutationConfig<typeof updateSmtpSettingsMutationFn>;
};

export function useCompleteSetupMutation(params: UseCompleteSetupMutationParams = {}) {
  return useMutation({
    mutationFn: completeSetupMutationFn,
    ...params.mutationConfig,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await activatePreparedSessionBinding();
      // Setup response sudah membawa status terbaru, jadi cache setup bisa langsung akurat tanpa menunggu refetch.
      queryClient.setQueryData(setupKeys.status(), data.setup);
      queryClient.invalidateQueries({ queryKey: projectsKeys.all });
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useUpdateAuthSettingsMutation(params: UseUpdateAuthSettingsMutationParams = {}) {
  return useMutation({
    mutationFn: updateAuthSettingsMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Signup policy memengaruhi setup status dan admin settings, jadi dua cache ringan ini dibuat langsung konsisten.
      queryClient.setQueryData(setupKeys.authSettings(), data);
      queryClient.setQueryData(setupKeys.status(), (current) =>
        current
          ? {
              ...current,
              signupPolicy: data.signupPolicy,
            }
          : current,
      );
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useUpdateOidcProviderMutation(params: UseUpdateOidcProviderMutationParams = {}) {
  return useMutation({
    mutationFn: updateOidcProviderMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(setupKeys.oidcProvider(), data);
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useUpdateSmtpSettingsMutation(params: UseUpdateSmtpSettingsMutationParams = {}) {
  return useMutation({
    mutationFn: updateSmtpSettingsMutationFn,
    ...params.mutationConfig,
    onSuccess: (data, variables, onMutateResult, context) => {
      // SMTP password bersifat write-only; response server menjadi satu-satunya sumber status configured yang aman di cache.
      queryClient.setQueryData(setupKeys.smtpSettings(), data);
      params.mutationConfig?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}
