import crypto from 'crypto';
import { prisma } from './prisma';
import bcrypt from 'bcryptjs';

// Generar token de reset de contraseña
export async function generateResetToken(email: string) {
  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) {
    throw new Error('No se encontró un usuario con ese email');
  }

  // Generar token único
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hora

  // Guardar token en la base de datos
  await prisma.user.update({
    where: { email },
    data: {
      resetToken,
      resetTokenExpiry
    }
  });

  return resetToken;
}

// Verificar y resetear contraseña
export async function resetPassword(token: string, newPassword: string) {
  const user = await prisma.user.findUnique({
    where: { resetToken: token }
  });

  if (!user) {
    throw new Error('Token inválido');
  }

  if (!user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
    throw new Error('Token expirado');
  }

  // Hashear nueva contraseña
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Actualizar contraseña y limpiar token
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      resetToken: null,
      resetTokenExpiry: null
    }
  });

  return true;
}

// Verificar si un token es válido
export async function verifyResetToken(token: string) {
  const user = await prisma.user.findUnique({
    where: { resetToken: token }
  });

  if (!user) {
    return false;
  }

  if (!user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
    return false;
  }

  return true;
}
